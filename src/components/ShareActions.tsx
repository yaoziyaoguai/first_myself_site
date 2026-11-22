"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

interface ShareActionsProps {
  url: string;
  title: string;
  summary?: string;
  children?: ReactNode;
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

export function ShareActions({ url, title, summary, children }: ShareActionsProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  // server snapshot 固定为 false，浏览器接管后再读取真实能力，避免 hydration 漂移。
  const canNativeShare = useSyncExternalStore(
    subscribeToNativeShare,
    getNativeShareSnapshot,
    getServerNativeShareSnapshot,
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
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

  const share = new URLSearchParams({ url, text: summary ? `${title} - ${summary}` : title });

  return (
    <div className="reader-actions" role="group" aria-label="认可与分享">
      {children}
      <button className="reader-action" onClick={handleCopy} type="button" aria-live="polite">
        {copyStatus === "copied" ? "已复制 ✓" : copyStatus === "failed" ? "重试复制" : "复制链接"}
      </button>
      {canNativeShare && (
        <button className="reader-action" onClick={handleNativeShare} type="button">分享</button>
      )}
      <a className="reader-action" href={`https://twitter.com/intent/tweet?${share}`} target="_blank" rel="noopener noreferrer">
        分享到 X
      </a>
      <a className="reader-action" href="/rss.xml">RSS</a>
    </div>
  );
}
