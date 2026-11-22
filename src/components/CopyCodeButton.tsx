"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";

export function CopyCodeButton() {
  const [feedback, setFeedback] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (feedback !== "copied") return;
    const timeout = window.setTimeout(() => setFeedback("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

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
    <button className="article-code-copy" type="button" data-copied={feedback === "copied"} onClick={copy}>
      <span className="article-code-copy-icon" aria-hidden="true">
        <Copy className="copy-code-icon" size={14} />
        <Check className="copy-check-icon" size={14} />
      </span>
      <span aria-live="polite">
        {feedback === "copied" ? "已复制" : feedback === "failed" ? "重试复制" : "复制代码"}
      </span>
    </button>
  );
}
