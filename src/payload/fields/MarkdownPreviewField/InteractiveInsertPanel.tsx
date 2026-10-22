"use client";

import { useCallback, useRef, useState } from "react";
import { uploadAndInsert } from "./interactive";

/**
 * “插入互动内容”面板。
 *
 * 只负责收集已审查的公开副本与说明；上传与插入由共享模块完成，
 * 失败时不触碰正文。资源“待上传”的私有草稿仍可保存，但公开/ready
 * 由服务端门禁强制要求资源齐全。
 */

export type InteractiveInsertPanelProps = {
  blogId?: string | number | null;
  currentMarkdown: string;
  disabled?: boolean;
  /** 在提交时读取光标位置（渲染期不读取 ref）。 */
  getCursorOffset?: () => number | undefined;
  onInserted: (
    markdown: string,
    info: { sha256: string; byteLength: number },
  ) => void;
};

export function InteractiveInsertPanel({
  blogId,
  currentMarkdown,
  disabled,
  getCursorOffset,
  onInserted,
}: InteractiveInsertPanelProps) {
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setCaption("");
    setSummary("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const submit = useCallback(async () => {
    if (blogId === undefined || blogId === null) {
      setMessage({
        kind: "error",
        text: "请先保存草稿获得文章 ID，再插入互动内容。",
      });
      return;
    }
    if (!file) {
      setMessage({ kind: "error", text: "请选择已审查的公开副本（.html）。" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await uploadAndInsert({
        blogId,
        file,
        caption,
        summary,
        currentMarkdown,
        offset: getCursorOffset?.(),
      });
      if (!result.ok) {
        setMessage({ kind: "error", text: result.message });
        return;
      }
      onInserted(result.markdown, {
        sha256: result.sha256,
        byteLength: result.byteLength,
      });
      setMessage({ kind: "ok", text: "已插入互动内容，保存草稿后生效。" });
      reset();
    } catch {
      setMessage({
        kind: "error",
        text: "网络请求失败，请重试；正文未被修改。",
      });
    } finally {
      setBusy(false);
    }
  }, [
    blogId,
    caption,
    currentMarkdown,
    file,
    getCursorOffset,
    onInserted,
    reset,
    summary,
  ]);

  return (
    <div className="mpf-interactive">
      <button
        type="button"
        className="mpf-interactive__toggle"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "收起互动内容" : "插入互动内容"}
      </button>

      {open ? (
        <div className="mpf-interactive__panel">
          <p className="mpf-interactive__hint">
            上传经过审查的公开副本（已清除生成器隐藏源文等）。原始生成文件保持不变；
            资源暂缺时仍可保存为私有草稿，但公开文章与 Agent ready
            索引要求全部资源就绪。
          </p>
          <label className="mpf-interactive__field">
            <span>公开副本（.html）</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,text/html"
              disabled={busy || disabled}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="mpf-interactive__field">
            <span>标题（读者可见，必填）</span>
            <input
              type="text"
              value={caption}
              maxLength={200}
              disabled={busy || disabled}
              onChange={(event) => setCaption(event.target.value)}
            />
          </label>
          <label className="mpf-interactive__field">
            <span>说明（读者与 Agent 可见，可选）</span>
            <textarea
              value={summary}
              maxLength={1000}
              rows={2}
              disabled={busy || disabled}
              onChange={(event) => setSummary(event.target.value)}
            />
          </label>
          <div className="mpf-interactive__actions">
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => void submit()}
            >
              {busy ? "上传中…" : "上传并插入"}
            </button>
          </div>
          {message ? (
            <p
              className={`mpf-interactive__message mpf-interactive__message--${message.kind}`}
              role={message.kind === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default InteractiveInsertPanel;
