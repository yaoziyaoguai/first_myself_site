"use client";

import { useState } from "react";

interface ShareActionsProps {
  url: string;
  title: string;
  summary?: string;
}

export function ShareActions({ url, title, summary }: ShareActionsProps) {
  const [copied, setCopied] = useState(false);

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API 失败时静默处理
    }
  };

  const handleNativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ url, title, text: summary });
      }
    } catch {
      // 用户取消或 share API 失败时静默处理
    }
  };

  const shareToX = () => {
    const text = summary ? `${title} - ${summary}` : title;
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      "_blank"
    );
  };

  return (
    <div className="mt-10 pt-6 border-t border-border">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium mb-1">喜欢这篇文章？分享给更多人</p>
          <p className="text-xs text-muted-foreground">复制链接或分享到社交媒体</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              分享
            </button>
          )}
          <button
            onClick={handleCopy}
            className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-border bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {copied ? "已复制 ✓" : "复制链接"}
          </button>
          <button
            onClick={shareToX}
            className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            分享到 X
          </button>
        </div>
      </div>
    </div>
  );
}