"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";
import type { BlogAgentResponse } from "@/lib/blog-agent/types";
import { SafeAgentMarkdown } from "./SafeAgentMarkdown";

type AgentPhase =
  | "closed"
  | "idle"
  | "loading"
  | "answered"
  | "insufficient"
  | "limited"
  | "failed";

type AgentState = {
  phase: AgentPhase;
  response: BlogAgentResponse | null;
  lastQuestion: string;
};

type AgentAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "loading"; question: string }
  | { type: "answered"; response: BlogAgentResponse }
  | { type: "insufficient"; response: BlogAgentResponse }
  | { type: "limited" }
  | { type: "failed" };

const INITIAL_STATE: AgentState = {
  phase: "closed",
  response: null,
  lastQuestion: "",
};

const SUGGESTED_QUESTIONS = [
  "这篇文章解决了什么问题？",
  "核心实现是什么？",
  "作者得出了什么结论？",
] as const;

function reducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case "open":
      return { ...INITIAL_STATE, phase: "idle" };
    case "close":
      return INITIAL_STATE;
    case "loading":
      return {
        phase: "loading",
        response: null,
        lastQuestion: action.question,
      };
    case "answered":
      return { ...state, phase: "answered", response: action.response };
    case "insufficient":
      return { ...state, phase: "insufficient", response: action.response };
    case "limited":
      return { ...state, phase: "limited", response: null };
    case "failed":
      return { ...state, phase: "failed", response: null };
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseResponse(value: unknown, articleSlug: string): BlogAgentResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.queryId !== "string" ||
    !(record.answer === null || typeof record.answer === "string") ||
    !isStringArray(record.citationIds) ||
    typeof record.insufficientEvidence !== "boolean" ||
    !record.usage ||
    typeof record.usage !== "object" ||
    Array.isArray(record.usage) ||
    typeof (record.usage as Record<string, unknown>).cached !== "boolean" ||
    !Array.isArray(record.citations)
  ) {
    return null;
  }
  const baseUrl = `/blog/${encodeURIComponent(articleSlug)}`;
  const citations = record.citations.flatMap((citation) => {
    if (!citation || typeof citation !== "object" || Array.isArray(citation)) return [];
    const item = citation as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      typeof item.heading !== "string" ||
      typeof item.url !== "string" ||
      !(item.url === baseUrl || item.url.startsWith(`${baseUrl}#`))
    ) {
      return [];
    }
    return [{ id: item.id, heading: item.heading, url: item.url }];
  });
  if (citations.length !== record.citations.length) return null;
  const usageRecord = record.usage as Record<string, unknown>;
  const reason = usageRecord.reason;
  if (
    reason !== undefined &&
    reason !== "rate-limited" &&
    reason !== "provider-unavailable" &&
    reason !== "generation-disabled"
  ) {
    return null;
  }
  return {
    queryId: record.queryId,
    answer: record.answer,
    citationIds: record.citationIds,
    citations,
    insufficientEvidence: record.insufficientEvidence,
    usage: {
      cached: usageRecord.cached as boolean,
      ...(reason ? { reason } : {}),
    },
  };
}

export function BlogAgent({
  articleSlug,
  articleTitle,
}: {
  articleSlug: string;
  articleTitle: string;
}) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [draft, setDraft] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const loadingRef = useRef(false);

  const close = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    requestSequence.current += 1;
    loadingRef.current = false;
    setDraft("");
    dispatch({ type: "close" });
    queueMicrotask(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (state.phase === "idle") inputRef.current?.focus();
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "closed") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, state.phase]);

  useEffect(() => () => {
    controllerRef.current?.abort();
    requestSequence.current += 1;
  }, []);

  const ask = useCallback(async (questionValue: string) => {
    const question = questionValue.trim();
    if (!question || question.length > 500 || loadingRef.current) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    loadingRef.current = true;
    setDraft(question);
    dispatch({ type: "loading", question });
    try {
      const response = await fetch(
        `/api/blog/${encodeURIComponent(articleSlug)}/agent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        },
      );
      if (sequence !== requestSequence.current) return;
      if (response.status === 429) {
        dispatch({ type: "limited" });
        return;
      }
      if (!response.ok) {
        dispatch({ type: "failed" });
        return;
      }
      const parsed = parseResponse(await response.json(), articleSlug);
      if (!parsed) {
        dispatch({ type: "failed" });
      } else if (parsed.insufficientEvidence) {
        dispatch({ type: "insufficient", response: parsed });
      } else if (parsed.answer) {
        dispatch({ type: "answered", response: parsed });
      } else {
        dispatch({ type: "failed" });
      }
    } catch (error) {
      if (
        sequence === requestSequence.current &&
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        dispatch({ type: "failed" });
      }
    } finally {
      if (sequence === requestSequence.current) {
        loadingRef.current = false;
        controllerRef.current = null;
      }
    }
  }, [articleSlug]);

  const open = () => {
    setDraft("");
    dispatch({ type: "open" });
  };

  const selectCitation = (url: string) => {
    const fragment = url.split("#", 2)[1];
    if (!fragment) return;
    let id: string;
    try {
      id = decodeURIComponent(fragment);
    } catch {
      return;
    }
    const heading = document.getElementById(id);
    if (!heading) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    close();
  };

  const loading = state.phase === "loading";

  return (
    <div className="blog-agent-root">
      {state.phase !== "closed" && (
        <section
          className="blog-agent-panel"
          role="dialog"
          aria-label="文章问答"
          aria-modal="false"
        >
          <header className="blog-agent-panel-header">
            <div>
              <p className="blog-agent-kicker">
                <Sparkles aria-hidden="true" size={14} /> ARTICLE AGENT
              </p>
              <h2>正在阅读《{articleTitle}》</h2>
            </div>
            <button
              type="button"
              className="blog-agent-icon-button"
              aria-label="关闭文章 Agent"
              onClick={close}
            >
              <X aria-hidden="true" size={18} />
            </button>
          </header>

          <div className="blog-agent-panel-body" aria-live="polite">
            <p className="blog-agent-scope-note">
              我只依据当前文章回答，并附上可跳转的原文位置。
            </p>

            <div className="blog-agent-suggestions" aria-label="建议问题">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  type="button"
                  key={question}
                  disabled={loading}
                  onClick={() => void ask(question)}
                >
                  {question}
                </button>
              ))}
            </div>

            {loading && (
              <div className="blog-agent-status">
                <Loader2 className="animate-spin" aria-hidden="true" size={18} />
                <span>正在阅读文章并整理依据…</span>
              </div>
            )}

            {state.phase === "answered" && state.response?.answer && (
              <div className="blog-agent-result">
                <SafeAgentMarkdown content={state.response.answer} />
                {state.response.citations.length > 0 && (
                  <div className="blog-agent-citations">
                    <p>原文依据</p>
                    {state.response.citations.map((citation) => (
                      <button
                        type="button"
                        key={citation.id}
                        aria-label={`查看引用：${citation.heading}`}
                        onClick={() => selectCitation(citation.url)}
                      >
                        <span>{citation.heading}</span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {state.phase === "insufficient" && (
              <div className="blog-agent-status blog-agent-status-muted">
                这篇文章暂时没有足够信息回答这个问题。
              </div>
            )}
            {state.phase === "limited" && (
              <div className="blog-agent-status blog-agent-status-muted">
                请求有点多，请稍后再试。
              </div>
            )}
            {state.phase === "failed" && (
              <div className="blog-agent-status blog-agent-status-error">
                <span>暂时无法回答，请稍后重试。</span>
                <button type="button" onClick={() => void ask(state.lastQuestion)}>
                  重试
                </button>
              </div>
            )}
          </div>

          <form
            className="blog-agent-form"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft);
            }}
          >
            <label htmlFor="blog-agent-question">向文章提问</label>
            <div>
              <textarea
                ref={inputRef}
                id="blog-agent-question"
                value={draft}
                maxLength={500}
                rows={2}
                disabled={loading}
                placeholder="例如：为什么这样设计？"
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="submit"
                aria-label="发送问题"
                disabled={loading || !draft.trim()}
              >
                {loading
                  ? <Loader2 className="animate-spin" aria-hidden="true" size={18} />
                  : <Send aria-hidden="true" size={18} />}
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        ref={triggerRef}
        type="button"
        className="blog-agent-trigger"
        aria-label="打开文章 Agent"
        aria-expanded={state.phase !== "closed"}
        onClick={state.phase === "closed" ? open : undefined}
      >
        <span className="blog-agent-trigger-icon">
          <Bot aria-hidden="true" size={22} />
          <Sparkles aria-hidden="true" size={11} />
        </span>
        <span>问问这篇文章</span>
      </button>
    </div>
  );
}
