"use client";

import { useState } from "react";

export function HeadingLink({ id }: { id: string }) {
  const [status, setStatus] = useState<"copied" | "failed">();
  async function copy() {
    const url = new URL(location.href);
    url.hash = encodeURIComponent(id);
    try {
      await navigator.clipboard.writeText(url.href);
      setStatus("copied");
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "NotAllowedError") throw error;
      setStatus("failed");
    }
  }
  return (
    <button type="button" className="article-heading-link" aria-label="复制本节链接"
      title="复制本节链接" data-copied={status === "copied"} onClick={copy}>
      <span className="sr-only" role="status">
        {status === "copied" ? "已复制本节链接" : status === "failed" ? "无法复制本节链接" : ""}
      </span>
    </button>
  );
}
