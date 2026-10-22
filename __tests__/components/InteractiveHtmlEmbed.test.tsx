import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveHtmlEmbed } from "@/components/InteractiveHtmlEmbed";
import { MarkdownArticle } from "@/components/MarkdownArticle";
import { canonicalFence } from "@/lib/interactive-html/marker";

const SHA = "a".repeat(64);
const MARKER = {
  version: 1 as const,
  id: "demo",
  sha256: SHA,
  caption: "排队延迟",
  summary: "拖动滑块",
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function markdownWithMarkers(): string {
  return [
    "前言",
    "",
    canonicalFence(MARKER),
    "",
    "中间段落",
    "",
    canonicalFence({ ...MARKER, id: "second", caption: "第二个块" }),
    "",
    "结尾",
  ].join("\n");
}

describe("InteractiveHtmlEmbed", () => {
  it("切换版本后忽略旧 HEAD 的迟到结果", async () => {
    let resolveRequest!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveRequest = resolve; }));
    const { rerender } = render(<InteractiveHtmlEmbed marker={MARKER} blogId="42" />);
    fireEvent.click(screen.getByRole("button", { name: "启动交互" }));
    rerender(<InteractiveHtmlEmbed marker={{ ...MARKER, sha256: "b".repeat(64) }} blogId="42" />);
    await act(async () => resolveRequest(new Response("", { status: 200 })));
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: "启动交互" })).toBeInTheDocument();
  });

  it("HEAD 超时终止请求并显示可重试错误", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    render(<InteractiveHtmlEmbed marker={MARKER} blogId="42" />);
    fireEvent.click(screen.getByRole("button", { name: "启动交互" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("超时");
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("宿主 Escape 收起后聚焦尺寸按钮，aria-controls 指向实际内容", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    const user = userEvent.setup();
    render(<InteractiveHtmlEmbed marker={MARKER} blogId="42" />);
    await user.click(screen.getByRole("button", { name: "启动交互" }));
    await user.click(await screen.findByRole("button", { name: "放大显示" }));
    const button = screen.getByRole("button", { name: "收回原尺寸" });
    expect(document.getElementById(button.getAttribute("aria-controls")!)?.querySelector("iframe")).not.toBeNull();
    screen.getByRole("button", { name: "停止交互" }).focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "放大显示" })).toHaveFocus();
  });
  it("初始只渲染标题/说明/启动按钮，不发任何请求", () => {
    render(<InteractiveHtmlEmbed marker={MARKER} blogId="42" />);
    expect(screen.getByText("排队延迟")).toBeInTheDocument();
    expect(screen.getByText("拖动滑块")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "启动交互" }),
    ).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("点击后才 HEAD 探测并挂载沙箱 iframe", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    const user = userEvent.setup();
    render(<InteractiveHtmlEmbed marker={MARKER} blogId="42" />);

    await user.click(screen.getByRole("button", { name: "启动交互" }));

    await waitFor(() =>
      expect(document.querySelector("iframe")).not.toBeNull(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/blog/42/interactive-html/${SHA}/view`);
    expect(init).toMatchObject({ method: "HEAD", cache: "no-store" });
    const iframe = document.querySelector("iframe")!;
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(iframe.getAttribute("src")).toBe(
      `/api/blog/42/interactive-html/${SHA}/view`,
    );
  });

  it("原位放大只改尺寸类名，不重建 iframe", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    const user = userEvent.setup();
    render(<InteractiveHtmlEmbed marker={MARKER} blogId="42" />);
    await user.click(screen.getByRole("button", { name: "启动交互" }));
    await waitFor(() =>
      expect(document.querySelector("iframe")).not.toBeNull(),
    );

    const before = document.querySelector("iframe");
    await user.click(screen.getByRole("button", { name: "放大显示" }));

    expect(screen.getByRole("button", { name: "收回原尺寸" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      document.querySelector(".interactive-html--expanded"),
    ).not.toBeNull();
    expect(document.querySelector("iframe")).toBe(before);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "收回原尺寸" }));
    expect(document.querySelector("iframe")).toBe(before);
    expect(document.querySelector(".interactive-html--expanded")).toBeNull();
  });

  it("停止交互销毁 iframe 并明示状态重置", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    const user = userEvent.setup();
    render(<InteractiveHtmlEmbed marker={MARKER} blogId="42" />);
    await user.click(screen.getByRole("button", { name: "启动交互" }));
    await waitFor(() =>
      expect(document.querySelector("iframe")).not.toBeNull(),
    );

    await user.click(screen.getByRole("button", { name: "停止交互" }));
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByText(/重置内部状态/)).toBeInTheDocument();
  });

  it("hash 或文章端点变化时销毁旧实例并重新等待启动", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    const user = userEvent.setup();
    const { rerender } = render(
      <InteractiveHtmlEmbed marker={MARKER} blogId="42" />,
    );
    await user.click(screen.getByRole("button", { name: "启动交互" }));
    await waitFor(() =>
      expect(document.querySelector("iframe")).not.toBeNull(),
    );

    rerender(
      <InteractiveHtmlEmbed
        marker={{ ...MARKER, sha256: "b".repeat(64) }}
        blogId="42"
      />,
    );

    await waitFor(() => expect(document.querySelector("iframe")).toBeNull());
    expect(
      screen.getByRole("button", { name: "启动交互" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("资源不可用时给出提示且不挂载 iframe", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    const user = userEvent.setup();
    render(<InteractiveHtmlEmbed marker={MARKER} blogId="42" />);
    await user.click(screen.getByRole("button", { name: "启动交互" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("不可用");
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("重试最多两次，第三次成功后恢复", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    const user = userEvent.setup();
    render(<InteractiveHtmlEmbed marker={MARKER} blogId="42" />);
    await user.click(screen.getByRole("button", { name: "启动交互" }));
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "重试" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() =>
      expect(document.querySelector("iframe")).not.toBeNull(),
    );
    expect(screen.queryByRole("button", { name: "重试" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("缺少 hash 时不发请求并提示未绑定", async () => {
    const user = userEvent.setup();
    render(
      <InteractiveHtmlEmbed
        marker={{ version: 1, id: "x", caption: "说明" }}
        blogId="42"
      />,
    );
    await user.click(screen.getByRole("button", { name: "启动交互" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("尚未绑定");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("网络异常给出可重试提示", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<InteractiveHtmlEmbed marker={MARKER} blogId="42" />);
    await user.click(screen.getByRole("button", { name: "启动交互" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("网络请求失败");
  });
});

describe("MarkdownArticle 互动块接入", () => {
  it("只把合法 marker 渲染为受控块，其余代码围栏保持普通代码", () => {
    const markdown = [
      canonicalFence(MARKER),
      "",
      "```js",
      "console.log(1)",
      "```",
      "",
      "```interactive-html",
      "not json",
      "```",
    ].join("\n");
    render(<MarkdownArticle markdown={markdown} blogId="42" />);

    expect(document.querySelectorAll(".interactive-html")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "启动交互" }),
    ).toBeInTheDocument();
    // 非法 marker 仍以普通代码块可见、不可执行。
    expect(screen.getByText("not json")).toBeInTheDocument();
    expect(screen.getByText("console.log(1)")).toBeInTheDocument();
  });

  it("多个 marker 各自独立，块间普通段落不影响数量", () => {
    render(<MarkdownArticle markdown={markdownWithMarkers()} blogId="42" />);
    expect(document.querySelectorAll(".interactive-html")).toHaveLength(2);
    expect(screen.getByText("中间段落")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "启动交互" })).toHaveLength(2);
  });

  it("在块前插入普通段落时不从 DOM 移走运行中的互动块", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    const user = userEvent.setup();
    const markdown = ["原有前言", "", canonicalFence(MARKER), "", "结尾"].join(
      "\n",
    );
    const { rerender } = render(
      <MarkdownArticle markdown={markdown} blogId="42" />,
    );
    await user.click(screen.getByRole("button", { name: "启动交互" }));
    await waitFor(() =>
      expect(document.querySelector("iframe")).not.toBeNull(),
    );

    const wrapper = document.querySelector(".interactive-html")!;
    const iframe = document.querySelector("iframe")!;
    const parent = wrapper.parentElement!;
    const removed: Node[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) removed.push(...record.removedNodes);
    });
    observer.observe(parent, { childList: true });

    rerender(
      <MarkdownArticle markdown={`新增前置段落\n\n${markdown}`} blogId="42" />,
    );
    observer.disconnect();

    expect(document.querySelector(".interactive-html")).toBe(wrapper);
    expect(document.querySelector("iframe")).toBe(iframe);
    expect(removed).not.toContain(wrapper);
  });

  it("marker 不会把 HTML 写进 RSC 之外的正文文本", () => {
    render(<MarkdownArticle markdown={markdownWithMarkers()} blogId="42" />);
    expect(document.body.textContent).not.toContain(SHA);
  });
});
