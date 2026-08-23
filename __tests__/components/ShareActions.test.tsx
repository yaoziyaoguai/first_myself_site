import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareActions } from "@/components/ShareActions";

const props = {
  url: "https://wangjinkun333.me/blog/agent-loop",
  title: "Agent Loop",
  summary: "一篇文章",
};

function setNativeShare(value: Navigator["share"] | undefined) {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value,
  });
}

describe("ShareActions", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    container?.remove();
    root = undefined;
    container = undefined;
    setNativeShare(undefined);
  });

  it("hydrates without a mismatch when native share exists only in the browser", async () => {
    setNativeShare(undefined);
    const serverHtml = renderToString(<ShareActions {...props} />);
    expect(serverHtml).not.toContain(">分享</button>");

    container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    setNativeShare(vi.fn(async () => undefined));
    const recoverableErrors: unknown[] = [];

    await act(async () => {
      root = hydrateRoot(container!, <ShareActions {...props} />, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
      await Promise.resolve();
    });

    expect(recoverableErrors).toEqual([]);
    expect(
      container.querySelectorAll("button")[0],
    ).toHaveTextContent("分享");
  });
});
