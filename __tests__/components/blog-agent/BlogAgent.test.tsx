import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlogAgent } from "@/components/blog-agent/BlogAgent";

const answerBody = {
  queryId: "query-1",
  answer: "批量写入可以减少小批次开销。",
  citationIds: ["section:0:写入路径"],
  citations: [{
    id: "section:0:写入路径",
    heading: "写入路径",
    url: "/blog/doris-write-path#写入路径",
  }],
  insufficientEvidence: false,
  usage: { cached: false },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderAgent() {
  return render(
    <BlogAgent
      articleSlug="doris-write-path"
      articleTitle="Doris 写入实践"
    />,
  );
}

async function openAgent(user = userEvent.setup()) {
  await user.click(screen.getByRole("button", { name: "打开文章 Agent" }));
  return user;
}

describe("BlogAgent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(answerBody)));
  });

  it("starts as an accessible floating robot and opens the current article panel", async () => {
    renderAgent();
    expect(screen.getByRole("button", { name: "打开文章 Agent" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await openAgent();
    expect(screen.getByRole("dialog", { name: "文章问答" })).toBeInTheDocument();
    expect(screen.getByText("正在阅读《Doris 写入实践》")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "这篇文章解决了什么问题？" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends only the selected question to the encoded current-article endpoint", async () => {
    renderAgent();
    const user = await openAgent();
    await user.click(screen.getByRole("button", { name: "这篇文章解决了什么问题？" }));

    await screen.findByText("批量写入可以减少小批次开销。");
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "/api/blog/doris-write-path/agent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ question: "这篇文章解决了什么问题？" }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("prevents duplicate submission while loading", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    renderAgent();
    const user = await openAgent();
    await user.type(screen.getByRole("textbox", { name: "向文章提问" }), "为什么批量写入？");
    const submit = screen.getByRole("button", { name: "发送问题" });
    await user.click(submit);

    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(fetch).toHaveBeenCalledOnce();

    resolveRequest?.(jsonResponse(answerBody));
    await screen.findByText("批量写入可以减少小批次开销。");
  });

  it("aborts an old request on close and ignores its late response", async () => {
    let resolveOld: ((response: Response) => void) | undefined;
    vi.mocked(fetch)
      .mockImplementationOnce((_url, options) => new Promise((resolve) => {
        expect(options?.signal).toBeInstanceOf(AbortSignal);
        resolveOld = resolve;
      }))
      .mockResolvedValueOnce(jsonResponse({ ...answerBody, answer: "新回答" }));
    renderAgent();
    const user = await openAgent();
    await user.type(screen.getByRole("textbox", { name: "向文章提问" }), "旧问题");
    await user.click(screen.getByRole("button", { name: "发送问题" }));
    await user.click(screen.getByRole("button", { name: "关闭文章 Agent" }));

    await openAgent(user);
    await user.type(screen.getByRole("textbox", { name: "向文章提问" }), "新问题");
    await user.click(screen.getByRole("button", { name: "发送问题" }));
    await screen.findByText("新回答");

    resolveOld?.(jsonResponse({ ...answerBody, answer: "过期回答" }));
    await Promise.resolve();
    expect(screen.queryByText("过期回答")).not.toBeInTheDocument();
  });

  it("ignores a response body that finishes parsing after close", async () => {
    let resolveBody: ((body: unknown) => void) | undefined;
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => new Promise((resolve) => {
        resolveBody = resolve;
      }),
    } as Response);
    renderAgent();
    const user = await openAgent();
    await user.click(screen.getByRole("button", { name: "核心实现是什么？" }));
    await waitFor(() => expect(resolveBody).toBeDefined());
    await user.click(screen.getByRole("button", { name: "关闭文章 Agent" }));

    await act(async () => resolveBody?.(answerBody));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("批量写入可以减少小批次开销。")).not.toBeInTheDocument();
  });

  it("aborts a pending request when the Agent unmounts", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation((_url, options) => {
      signal = options?.signal ?? undefined;
      return new Promise(() => undefined);
    });
    const view = renderAgent();
    const user = await openAgent();
    await user.click(screen.getByRole("button", { name: "核心实现是什么？" }));
    await waitFor(() => expect(signal).toBeDefined());

    view.unmount();

    expect(signal?.aborted).toBe(true);
  });

  it("closes on Escape and restores focus to the robot", async () => {
    renderAgent();
    await openAgent();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "打开文章 Agent" })).toHaveFocus();
    });
  });

  it("closes and scrolls to a real heading when a citation is selected", async () => {
    const heading = document.createElement("h2");
    heading.id = "写入路径";
    heading.scrollIntoView = vi.fn();
    document.body.appendChild(heading);
    renderAgent();
    const user = await openAgent();
    await user.click(screen.getByRole("button", { name: "核心实现是什么？" }));
    await user.click(await screen.findByRole("button", { name: "查看引用：写入路径" }));

    expect(heading.scrollIntoView).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    heading.remove();
  });

  it("closes and scrolls to the article top for a top-section citation", async () => {
    const articleTop = document.createElement("article");
    articleTop.id = "blog-article-top";
    articleTop.scrollIntoView = vi.fn();
    document.body.appendChild(articleTop);
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      ...answerBody,
      citationIds: ["section:0:top"],
      citations: [{
        id: "section:0:top",
        heading: "文章开头",
        url: "/blog/doris-write-path",
      }],
    }));
    renderAgent();
    const user = await openAgent();
    await user.click(screen.getByRole("button", { name: "核心实现是什么？" }));
    await user.click(await screen.findByRole("button", { name: "查看引用：文章开头" }));

    expect(articleTop.scrollIntoView).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    articleTop.remove();
  });

  it.each([
    [429, { ...answerBody, answer: null, citations: [], citationIds: [], usage: { cached: false, reason: "rate-limited" } }, "请求有点多，请稍后再试。"],
    [503, { ...answerBody, answer: null, citations: [], citationIds: [], usage: { cached: false, reason: "provider-unavailable" } }, "暂时无法回答，请稍后重试。"],
    [200, { ...answerBody, answer: null, citations: [], citationIds: [], insufficientEvidence: true }, "这篇文章暂时没有足够信息回答这个问题。"],
  ])("renders the safe state for HTTP %i", async (status, body, message) => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(body, status));
    renderAgent();
    const user = await openAgent();
    await user.click(screen.getByRole("button", { name: "作者得出了什么结论？" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("offers retry for malformed and network responses", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ answer: 42 }))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(jsonResponse(answerBody));
    renderAgent();
    const user = await openAgent();
    await user.click(screen.getByRole("button", { name: "核心实现是什么？" }));
    expect(await screen.findByText("暂时无法回答，请稍后重试。")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText("暂时无法回答，请稍后重试。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText("批量写入可以减少小批次开销。")).toBeInTheDocument();
  });
});
