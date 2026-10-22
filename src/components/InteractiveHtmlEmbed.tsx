"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { InteractiveHtmlMarker } from "@/lib/interactive-html/marker";

/**
 * 前台/后台共用的受控互动块。
 *
 * 初始 SSR 只有说明和按钮：没有 iframe、没有 HTML 字节、没有预取。
 * 点击后才 HEAD 取状态、再 GET 加载。原位放大复用同一个 wrapper 与
 * iframe（只改尺寸），不重新创建实例、不搬到弹窗。
 */

type LoadState = "idle" | "loading" | "ready" | "error" | "stopped";

export type InteractiveHtmlEmbedProps = {
  marker: InteractiveHtmlMarker;
  blogId?: string | number | null;
  mode?: "view" | "preview";
};

const RETRY_LIMIT = 2;

export function InteractiveHtmlEmbed({
  marker,
  blogId,
  mode = "view",
}: InteractiveHtmlEmbedProps) {
  const [state, setState] = useState<LoadState>("idle");
  const [expanded, setExpanded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [loadedEndpoint, setLoadedEndpoint] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const regionId = useId();
  const title = `${marker.caption}${marker.summary ? `：${marker.summary}` : ""}`;

  const endpoint =
    blogId !== undefined && blogId !== null && marker.sha256
      ? `/api/blog/${encodeURIComponent(String(blogId))}/interactive-html/${marker.sha256}/${mode}`
      : null;
  const previousEndpoint = useRef(endpoint);

  useEffect(() => {
    if (previousEndpoint.current !== endpoint) {
      previousEndpoint.current = endpoint;
      setLoadedEndpoint(null);
      setState("idle");
      setExpanded(false);
      setAttempt(0);
      setMessage(null);
    }
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [endpoint]);

  const load = useCallback(async () => {
    if (!endpoint) {
      setState("error");
      setMessage("互动资源尚未绑定到当前文章。");
      return;
    }
    setState("loading");
    setMessage(null);
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15_000);
    try {
      const head = await fetch(endpoint, {
        method: "HEAD",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      // 编辑器可在请求中途切换版本；旧请求不能覆盖新块的等待状态。
      if (requestRef.current !== controller) return;
      if (controller.signal.aborted) throw new Error("request aborted");
      if (head.status === 404) {
        setState("error");
        setMessage(
          "互动内容当前不可用：文章可能已撤回、改为私有或移除了引用。",
        );
        return;
      }
      if (head.status === 503) {
        setState("error");
        setMessage("互动内容暂时无法读取，请稍后重试。");
        return;
      }
      if (!head.ok) {
        setState("error");
        setMessage("互动内容未能加载。");
        return;
      }
      setFrameKey((value) => value + 1);
      setLoadedEndpoint(endpoint);
      setState("ready");
    } catch {
      if (requestRef.current !== controller) return;
      setState("error");
      setMessage(timedOut ? "互动内容加载超时，请重试。" : "网络请求失败，请检查连接后重试。");
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [endpoint]);

  const retry = useCallback(() => {
    if (attempt >= RETRY_LIMIT) return;
    setAttempt((value) => value + 1);
    void load();
  }, [attempt, load]);

  const stop = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoadedEndpoint(null);
    setState("stopped");
    setExpanded(false);
    setAttempt(0);
    setMessage("已停止交互，重新启动会重置内部状态。");
  }, []);

  const collapse = useCallback(() => {
    setExpanded(false);
    expandButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state === "stopped") startButtonRef.current?.focus();
  }, [state]);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!wrapperRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
      collapse();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [collapse, expanded]);

  return (
    <div
      ref={wrapperRef}
      className={`interactive-html${expanded ? " interactive-html--expanded" : ""}`}
      data-state={state}
      data-interactive-id={marker.id}
    >
      <div className="interactive-html__header">
        <p className="interactive-html__caption">{marker.caption}</p>
        {marker.summary ? (
          <p className="interactive-html__summary">{marker.summary}</p>
        ) : null}
      </div>

      {loadedEndpoint === null && state !== "loading" && state !== "error" ? (
        <div className="interactive-html__starter">
          <button
            ref={startButtonRef}
            type="button"
            className="interactive-html__start"
            onClick={() => void load()}
          >
            启动交互
          </button>
          <span className="interactive-html__hint">
            交互内容在点击后才加载；它是一个独立的沙箱页面，不会读取本站数据。
          </span>
        </div>
      ) : null}

      {state === "loading" ? (
        <p className="interactive-html__status" role="status">
          正在加载互动内容…
        </p>
      ) : null}

      {state === "error" ? (
        <div className="interactive-html__status" role="alert">
          <p>{message}</p>
          {attempt < RETRY_LIMIT ? (
            <button
              type="button"
              className="interactive-html__start"
              onClick={retry}
            >
              重试
            </button>
          ) : null}
        </div>
      ) : null}

      {state === "stopped" ? (
        <p className="interactive-html__status" role="status">
          {message}
        </p>
      ) : null}

      {state === "ready" && loadedEndpoint === endpoint && loadedEndpoint ? (
        <div id={regionId} className="interactive-html__frame-shell">
          <iframe
            key={frameKey}
            className="interactive-html__frame"
            src={loadedEndpoint}
            title={title}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          <div className="interactive-html__controls">
            <button
              ref={expandButtonRef}
              type="button"
              className="interactive-html__control"
              aria-expanded={expanded}
              aria-controls={regionId}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "收回原尺寸" : "放大显示"}
            </button>
            {attempt < RETRY_LIMIT ? (
              <button type="button" className="interactive-html__control" onClick={retry}>
                重新加载
              </button>
            ) : null}
            <button
              type="button"
              className="interactive-html__control"
              onClick={stop}
            >
              停止交互
            </button>
            <span className="interactive-html__hint">
              重新加载或停止交互会重置内部状态。
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
