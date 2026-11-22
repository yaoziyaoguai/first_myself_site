"use client";

import { useState, type MouseEvent } from "react";

export function CopyCodeButton() {
  const [feedback, setFeedback] = useState<"idle" | "copied" | "failed">("idle");

  async function copy(event: MouseEvent<HTMLButtonElement>) {
    const code = event.currentTarget.closest(".article-code")!.querySelector("pre code")!;
    const text = code.textContent!;
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "NotAllowedError") throw error;
      setFeedback("failed");
      return;
    }
    setFeedback("copied");
  }

  return (
    <button className="article-code-copy" type="button" onClick={copy}>
      <span aria-live="polite">
        {feedback === "copied" ? "已复制" : feedback === "failed" ? "重试复制" : "复制代码"}
      </span>
    </button>
  );
}
