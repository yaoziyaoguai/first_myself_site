"use client";

import { useState, useSyncExternalStore } from "react";

interface ShareActionsProps {
  url: string;
  title: string;
  summary?: string;
}

function subscribeToNativeShare() {
  return () => undefined;
}

function getNativeShareSnapshot() {
  return typeof navigator.share === "function";
}

function getServerNativeShareSnapshot() {
  return false;
}

export function ShareActions({ url, title, summary }: ShareActionsProps) {
  const [copied, setCopied] = useState(false);
  // server snapshot 固定为 false，浏览器接管后再读取真实能力，避免 hydration 漂移。
  const canNativeShare = useSyncExternalStore(
    subscribeToNativeShare,
    getNativeShareSnapshot,
    getServerNativeShareSnapshot,
  );

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
    <div className="mt-10 border-t border-border pt-7">
      <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="font-serif text-lg font-medium">分享这篇文章</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">复制链接，或分享到你常用的地方。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm transition-colors duration-200 hover:border-primary/45 hover:text-primary"
              type="button"
            >
              分享
            </button>
          )}
          <button
            onClick={handleCopy}
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-muted px-4 text-sm transition-colors duration-200 hover:border-primary/45 hover:text-primary"
            type="button"
            aria-live="polite"
          >
            {copied ? "已复制 ✓" : "复制链接"}
          </button>
          <button
            onClick={shareToX}
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm transition-colors duration-200 hover:border-primary/45 hover:text-primary"
            type="button"
          >
            分享到 X
          </button>
        </div>
      </div>
    </div>
  );
}
