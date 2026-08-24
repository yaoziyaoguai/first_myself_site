"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { MoveDiagonal2, Send, Sparkles, X } from "lucide-react";
import type {
  BlogAgentCitation,
  BlogAgentConversationTurn,
  BlogAgentResponse,
} from "@/lib/blog-agent/types";
import { SafeAgentMarkdown } from "./SafeAgentMarkdown";
import { buildGitHubSource } from "@/lib/blog-agent/githubSource";

type AgentPhase = "idle" | "loading" | "limited" | "failed";

type AgentTurn = {
  question: string;
  response: BlogAgentResponse;
};

type PanelSize = {
  width: number;
  height: number;
};

type PanelResizeStart = PanelSize & {
  pointerId: number;
  clientX: number;
  clientY: number;
};

type PanelStyle = CSSProperties & {
  "--blog-agent-panel-width": string;
  "--blog-agent-panel-height": string;
};

type AgentState = {
  isOpen: boolean;
  phase: AgentPhase;
  turns: AgentTurn[];
  pendingQuestion: string;
  lastQuestion: string;
};

type AgentAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "clear" }
  | { type: "loading"; question: string }
  | { type: "completed"; question: string; response: BlogAgentResponse }
  | { type: "limited" }
  | { type: "failed" };

const MAX_STORED_TURNS = 8;
const MAX_CONTEXT_TURNS = 3;
const MAX_CONTEXT_ANSWER_LENGTH = 1_200;
const MAX_STORED_ANSWER_LENGTH = 6_000;
const MAX_STORED_HISTORY_CHARACTERS = 48_000;
const MAX_REQUEST_BODY_BYTES = 8 * 1024;
const PANEL_SIZE_STORAGE_KEY = "blog-agent-panel-size:v1";
const DESKTOP_MEDIA_QUERY = "(min-width: 80rem)";
const MIN_PANEL_WIDTH = 360;
const MIN_PANEL_HEIGHT = 352;
const MAX_PANEL_WIDTH = 800;
const MAX_PANEL_HEIGHT = 832;
const PANEL_VIEWPORT_GUTTER = 40;
const PANEL_BOTTOM_CLEARANCE = 104;

const INITIAL_STATE: AgentState = {
  isOpen: false,
  phase: "idle",
  turns: [],
  pendingQuestion: "",
  lastQuestion: "",
};

const SUGGESTED_QUESTIONS = [
  "这篇文章解决了什么问题？",
  "核心实现是什么？",
  "作者得出了什么结论？",
] as const;

function ArticleAgentOrbIcon() {
  return (
    <span
      className="blog-agent-trigger-orb"
      data-blog-agent-mascot="orb"
      aria-hidden="true"
    />
  );
}

function reducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case "open":
      return { ...state, isOpen: true };
    case "close":
      return {
        ...state,
        isOpen: false,
        phase: "idle",
        pendingQuestion: "",
      };
    case "clear":
      return { ...INITIAL_STATE, isOpen: state.isOpen };
    case "loading":
      return {
        ...state,
        phase: "loading",
        pendingQuestion: action.question,
        lastQuestion: action.question,
      };
    case "completed":
      return {
        ...state,
        phase: "idle",
        pendingQuestion: "",
        turns: [...state.turns, {
          question: action.question,
          response: action.response,
        }].slice(-MAX_STORED_TURNS),
      };
    case "limited":
      return { ...state, phase: "limited", pendingQuestion: "" };
    case "failed":
      return { ...state, phase: "failed", pendingQuestion: "" };
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseGithubCitation(value: unknown): BlogAgentCitation["github"] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const source = buildGitHubSource(item);
  return source && item.url === source.url ? source : null;
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
    const github = item.github === undefined
      ? undefined
      : parseGithubCitation(item.github);
    if (item.github !== undefined && !github) return [];
    return [{
      id: item.id,
      heading: item.heading,
      url: item.url,
      ...(github ? { github } : {}),
    }];
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

function historyStorageKey(articleSlug: string): string {
  return `blog-agent-history:v1:${articleSlug}`;
}

function normalizePanelSize(size: PanelSize): PanelSize {
  return {
    width: Math.round(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, size.width))),
    height: Math.round(Math.min(MAX_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, size.height))),
  };
}

function clampPanelSize(size: PanelSize): PanelSize {
  const normalized = normalizePanelSize(size);
  const maxWidth = Math.max(
    MIN_PANEL_WIDTH,
    Math.min(MAX_PANEL_WIDTH, window.innerWidth - PANEL_VIEWPORT_GUTTER),
  );
  const maxHeight = Math.max(
    MIN_PANEL_HEIGHT,
    Math.min(MAX_PANEL_HEIGHT, window.innerHeight - PANEL_BOTTOM_CLEARANCE),
  );
  return {
    width: Math.min(maxWidth, normalized.width),
    height: Math.min(maxHeight, normalized.height),
  };
}

function readStoredPanelSize(): PanelSize | null {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(PANEL_SIZE_STORAGE_KEY) ?? "null",
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (
      typeof record.width !== "number" ||
      typeof record.height !== "number" ||
      !Number.isFinite(record.width) ||
      !Number.isFinite(record.height) ||
      record.width <= 0 ||
      record.height <= 0
    ) {
      return null;
    }
    return normalizePanelSize({ width: record.width, height: record.height });
  } catch {
    return null;
  }
}

function readStoredTurns(articleSlug: string): AgentTurn[] {
  try {
    const serialized = sessionStorage.getItem(historyStorageKey(articleSlug));
    if (!serialized || serialized.length > MAX_STORED_HISTORY_CHARACTERS) return [];
    const value: unknown = JSON.parse(serialized);
    if (!Array.isArray(value) || value.length > MAX_STORED_TURNS) return [];
    const turns: AgentTurn[] = [];
    for (const item of value) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      const question = typeof record.question === "string"
        ? record.question.trim()
        : "";
      const response = parseResponse(record.response, articleSlug);
      if (
        !question ||
        question.length > 500 ||
        !response ||
        (response.answer?.length ?? 0) > MAX_STORED_ANSWER_LENGTH ||
        (!response.answer && !response.insufficientEvidence)
      ) {
        return [];
      }
      turns.push({ question, response });
    }
    return turns;
  } catch {
    return [];
  }
}

function conversationContext(turns: AgentTurn[]): BlogAgentConversationTurn[] {
  return turns
    .flatMap((turn) => turn.response.answer
      ? [{
          question: turn.question,
          answer: turn.response.answer.slice(0, MAX_CONTEXT_ANSWER_LENGTH),
        }]
      : [])
    .slice(-MAX_CONTEXT_TURNS);
}

function requestBody(question: string, turns: AgentTurn[]): string {
  const history = conversationContext(turns);
  while (history.length > 0) {
    const serialized = JSON.stringify({ question, history });
    if (new TextEncoder().encode(serialized).byteLength <= MAX_REQUEST_BODY_BYTES) {
      return serialized;
    }
    history.shift();
  }
  return JSON.stringify({ question });
}

function ThinkingOrb() {
  return (
    <div
      className="blog-agent-thinking"
      role="status"
      aria-label="文章 Agent 正在思考"
    >
      <span className="blog-agent-orb" aria-hidden="true">
        <span />
      </span>
      <span className="blog-agent-thinking-copy">
        <strong>正在思考</strong>
        <span>正在检索当前文章与代码依据…</span>
      </span>
    </div>
  );
}

export function BlogAgent({
  articleSlug,
  articleTitle,
}: {
  articleSlug: string;
  articleTitle: string;
}) {
  const [state, dispatch] = useReducer(
    reducer,
    articleSlug,
    (slug): AgentState => ({
      ...INITIAL_STATE,
      turns: typeof window === "undefined" ? [] : readStoredTurns(slug),
    }),
  );
  const [draft, setDraft] = useState("");
  const [desktopLayout, setDesktopLayout] = useState(false);
  const [panelSize, setPanelSize] = useState<PanelSize | null>(() => (
    typeof window === "undefined" ? null : readStoredPanelSize()
  ));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const resizeStartRef = useRef<PanelResizeStart | null>(null);
  const requestSequence = useRef(0);
  const loadingRef = useRef(false);
  const storageKey = historyStorageKey(articleSlug);

  useEffect(() => {
    const media = window.matchMedia?.(DESKTOP_MEDIA_QUERY);
    const update = () => {
      const nextDesktopLayout = media?.matches ?? window.innerWidth >= 1_280;
      if (!nextDesktopLayout) resizeStartRef.current = null;
      setDesktopLayout(nextDesktopLayout);
    };
    update();
    media?.addEventListener?.("change", update);
    return () => media?.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!panelSize) return;
    try {
      sessionStorage.setItem(PANEL_SIZE_STORAGE_KEY, JSON.stringify(panelSize));
    } catch {
      // 浏览器禁用或配额不足时仅降级为当前页面内尺寸，不影响问答。
    }
  }, [panelSize]);

  useEffect(() => {
    const cancelResize = () => {
      resizeStartRef.current = null;
    };
    window.addEventListener("blur", cancelResize);
    return () => window.removeEventListener("blur", cancelResize);
  }, []);

  const close = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    requestSequence.current += 1;
    loadingRef.current = false;
    resizeStartRef.current = null;
    dispatch({ type: "close" });
    queueMicrotask(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    try {
      if (state.turns.length === 0) {
        sessionStorage.removeItem(storageKey);
        return;
      }
      const serialized = JSON.stringify(state.turns);
      if (serialized.length <= MAX_STORED_HISTORY_CHARACTERS) {
        sessionStorage.setItem(storageKey, serialized);
      }
    } catch {
      // 浏览器禁用或配额不足时仅降级为当前页面内历史，不影响问答。
    }
  }, [state.turns, storageKey]);

  useEffect(() => {
    if (state.isOpen && state.phase !== "loading") inputRef.current?.focus();
  }, [state.isOpen, state.phase]);

  useEffect(() => {
    if (!state.isOpen || !bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [state.isOpen, state.phase, state.turns.length]);

  useEffect(() => {
    if (!state.isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, state.isOpen]);

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
          body: requestBody(question, state.turns),
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
      const body = await response.json();
      if (sequence !== requestSequence.current) return;
      const parsed = parseResponse(body, articleSlug);
      if (!parsed || (!parsed.insufficientEvidence && !parsed.answer)) {
        dispatch({ type: "failed" });
        return;
      }
      dispatch({ type: "completed", question, response: parsed });
      setDraft("");
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
  }, [articleSlug, state.turns]);

  const clearHistory = () => {
    if (loadingRef.current) return;
    setDraft("");
    dispatch({ type: "clear" });
  };

  const selectCitation = (url: string) => {
    const fragment = url.split("#", 2)[1];
    let target: HTMLElement | null;
    if (!fragment) {
      target = document.getElementById("blog-article-top");
    } else {
      let id: string;
      try {
        id = decodeURIComponent(fragment);
      } catch {
        return;
      }
      target = document.getElementById(id);
    }
    if (!target) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    close();
  };

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!desktopLayout || event.button !== 0 || !panelRef.current) return;
    event.currentTarget.focus();
    const bounds = panelRef.current.getBoundingClientRect();
    resizeStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      width: bounds.width,
      height: bounds.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const resizeFromPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = resizeStartRef.current;
    if (!start || event.pointerId !== start.pointerId) return;
    setPanelSize(clampPanelSize({
      width: start.width - (event.clientX - start.clientX),
      height: start.height - (event.clientY - start.clientY),
    }));
  };

  const finishResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== resizeStartRef.current?.pointerId) return;
    resizeStartRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resizeWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!desktopLayout || !panelRef.current || resizeStartRef.current) return;
    const step = event.shiftKey ? 32 : 12;
    const bounds = panelRef.current.getBoundingClientRect();
    const next = { width: bounds.width, height: bounds.height };
    if (event.key === "ArrowLeft") next.width += step;
    else if (event.key === "ArrowRight") next.width -= step;
    else if (event.key === "ArrowUp") next.height += step;
    else if (event.key === "ArrowDown") next.height -= step;
    else return;
    event.preventDefault();
    setPanelSize(clampPanelSize(next));
  };

  const loading = state.phase === "loading";
  const panelStyle: PanelStyle | undefined = panelSize
    ? {
        "--blog-agent-panel-width": `${panelSize.width}px`,
        "--blog-agent-panel-height": `${panelSize.height}px`,
      }
    : undefined;

  return (
    <div className="blog-agent-root">
      {state.isOpen && (
        <section
          ref={panelRef}
          className="blog-agent-panel"
          role="dialog"
          aria-label="文章问答"
          aria-modal="false"
          style={panelStyle}
        >
          {desktopLayout && (
            <button
              type="button"
              className="blog-agent-resize-handle"
              aria-label="调整文章 Agent 对话框大小"
              title="拖动或使用方向键调整大小"
              onPointerDown={beginResize}
              onPointerMove={resizeFromPointer}
              onPointerUp={finishResize}
              onPointerCancel={finishResize}
              onLostPointerCapture={finishResize}
              onKeyDown={resizeWithKeyboard}
            >
              <MoveDiagonal2 aria-hidden="true" size={15} />
            </button>
          )}
          <header className="blog-agent-panel-header">
            <div>
              <p className="blog-agent-kicker">
                <Sparkles aria-hidden="true" size={14} /> ARTICLE AGENT
              </p>
              <h2>正在阅读《{articleTitle}》</h2>
            </div>
            <div className="blog-agent-header-actions">
              {state.turns.length > 0 && (
                <button
                  type="button"
                  className="blog-agent-clear-button"
                  disabled={loading}
                  onClick={clearHistory}
                >
                  清空对话
                </button>
              )}
              <button
                type="button"
                className="blog-agent-icon-button"
                aria-label="关闭文章 Agent"
                onClick={close}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
          </header>

          <div ref={bodyRef} className="blog-agent-panel-body" aria-live="polite">
            <p className="blog-agent-scope-note">
              我只依据当前文章回答，并附上可跳转的原文位置。
            </p>

            {state.turns.length === 0 && !loading && (
              <div className="blog-agent-suggestions" aria-label="建议问题">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    type="button"
                    key={question}
                    onClick={() => void ask(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            {state.turns.length > 0 && (
              <div className="blog-agent-transcript" aria-label="对话记录">
                {state.turns.map((turn, index) => (
                  <article
                    className="blog-agent-turn"
                    key={`${turn.response.queryId}:${index}`}
                  >
                    <div className="blog-agent-user-message">
                      <span aria-hidden="true">你</span>
                      <p>{turn.question}</p>
                    </div>
                    {turn.response.insufficientEvidence ? (
                      <div className="blog-agent-status blog-agent-status-muted">
                        这篇文章暂时没有足够信息回答这个问题。
                      </div>
                    ) : turn.response.answer ? (
                      <div className="blog-agent-result">
                        <SafeAgentMarkdown content={turn.response.answer} />
                        {turn.response.citations.length > 0 && (
                          <div className="blog-agent-citations">
                            <p>
                              {turn.response.citations.some((citation) => citation.github)
                                ? "依据与源码"
                                : "原文依据"}
                            </p>
                            {turn.response.citations.map((citation) => (
                              <div className="blog-agent-citation" key={citation.id}>
                                {citation.github && (
                                  <a
                                    href={citation.github.url}
                                    aria-label={`查看 GitHub 源码 ${citation.github.path} 第 ${citation.github.lineStart} 到 ${citation.github.lineEnd} 行`}
                                  >
                                    <span>查看源码 · {citation.github.path}</span>
                                    <span>
                                      L{citation.github.lineStart}–L{citation.github.lineEnd} ↗
                                    </span>
                                  </a>
                                )}
                                <button
                                  type="button"
                                  className={citation.github
                                    ? "blog-agent-citation-article"
                                    : undefined}
                                  aria-label={`${citation.github
                                    ? "查看文章依据"
                                    : "查看引用"}：${citation.heading}`}
                                  onClick={() => selectCitation(citation.url)}
                                >
                                  <span>
                                    {citation.github ? "文章依据 · " : ""}
                                    {citation.heading}
                                  </span>
                                  <span aria-hidden="true">{citation.github ? "↓" : "↗"}</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}

            {loading && (
              <div className="blog-agent-pending-turn">
                <div className="blog-agent-user-message">
                  <span aria-hidden="true">你</span>
                  <p>{state.pendingQuestion}</p>
                </div>
                <ThinkingOrb />
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
                {loading ? (
                  <span className="blog-agent-send-thinking" aria-hidden="true">
                    <span />
                  </span>
                ) : (
                  <Send aria-hidden="true" size={18} />
                )}
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
        aria-expanded={state.isOpen}
        onClick={state.isOpen ? undefined : () => dispatch({ type: "open" })}
      >
        <span className="blog-agent-trigger-icon">
          <ArticleAgentOrbIcon />
        </span>
        <span>问问这篇文章</span>
      </button>
    </div>
  );
}
