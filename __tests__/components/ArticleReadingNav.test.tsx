import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleReadingNav } from "@/components/ArticleReadingNav";

let frame: FrameRequestCallback;
const disconnect = vi.fn();
beforeEach(() => {
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback) => {
      frame = callback;
      return 1;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function Article({
  headings = ["中文标题", "中文标题-2", "恢复"],
}: {
  headings?: string[];
}) {
  return (
    <>
      <ArticleReadingNav articleSlug="real-article" />
      <div id="article-content">
        {headings.map((id) => (
          <h2 key={id} id={id} tabIndex={-1}>
            {id}
          </h2>
        ))}
        <pre>{"## 不应当进入目录"}</pre>
      </div>
    </>
  );
}

describe("ArticleReadingNav", () => {
  it("uses rendered, including repeated, heading IDs and cleans up its observer", () => {
    const { unmount } = render(<Article />);
    act(() => frame(0));
    const nav = screen.getByRole("navigation", { name: "本文目录" });
    expect(
      within(nav).getByRole("link", { name: /中文标题-2/ }),
    ).toHaveAttribute("href", `#${encodeURIComponent("中文标题-2")}`);
    expect(within(nav).queryByText("不应当进入目录")).not.toBeInTheDocument();
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("closes the mobile disclosure and transfers focus to the chosen heading", async () => {
    const user = userEvent.setup();
    const { container } = render(<Article />);
    act(() => frame(0));
    const details = container.querySelector("details")!;
    details.open = true;
    await user.click(within(details).getByRole("link", { name: /恢复/ }));
    expect(details.open).toBe(false);
    expect(document.getElementById("恢复")).toHaveFocus();
  });

  it("does not add a directory to a short note", () => {
    render(<Article headings={["一个章节"]} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
