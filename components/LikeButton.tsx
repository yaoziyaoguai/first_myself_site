"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Heart, Loader2 } from "lucide-react";
import {
  getLikeStatus,
  createLike,
  type LikeStatus,
} from "@/lib/likes";

interface LikeButtonProps {
  targetId: string;
  targetType: "blog" | "project";
  className?: string;
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
}

export function LikeButton({
  targetId,
  targetType,
  className,
  showCount = true,
  size = "md",
}: LikeButtonProps) {
  const [status, setStatus] = useState<LikeStatus>({
    count: 0,
    hasLiked: false,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取客户端 IP 哈希
  const getClientIpHash = async (): Promise<string> => {
    try {
      const response = await fetch("/api/ip");
      if (response.ok) {
        const data = await response.json();
        return hashString(data.ip || "unknown");
      }
    } catch (_e) {
      // 降级：使用随机字符串
    }
    return hashString("unknown-" + Date.now());
  };

  // 简单的浏览器指纹
  const getBrowserFingerprint = (): string => {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
    ];
    return hashString(components.join("|"));
  };

  // 简单的字符串哈希
  const hashString = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  // 加载点赞状态
  const loadLikeStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const ipHash = await getClientIpHash();
      const fingerprint = getBrowserFingerprint();

      const likeStatus = await getLikeStatus(targetId, targetType, ipHash, fingerprint);
      setStatus(likeStatus);
    } catch (err) {
      console.error("Failed to load like status:", err);
      setError("加载点赞状态失败");
    } finally {
      setLoading(false);
    }
  }, [targetId, targetType]);

  // 初始加载
  useEffect(() => {
    loadLikeStatus();
  }, [loadLikeStatus]);

  // 处理点赞
  const handleLike = async () => {
    if (status.hasLiked || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const ipHash = await getClientIpHash();
      const fingerprint = getBrowserFingerprint();

      await createLike({
        targetId,
        targetType,
        ipHash,
        fingerprint,
      });

      // 更新本地状态
      setStatus((prev) => ({
        count: prev.count + 1,
        hasLiked: true,
      }));
    } catch (err) {
      console.error("Failed to create like:", err);
      if (err instanceof Error && err.message.includes("已经点赞")) {
        setStatus((prev) => ({ ...prev, hasLiked: true }));
      } else {
        setError("点赞失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 尺寸配置
  const sizeClasses = {
    sm: "h-7 px-2 text-xs",
    md: "h-9 px-3 text-sm",
    lg: "h-11 px-4 text-base",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant={status.hasLiked ? "default" : "outline"}
        size="sm"
        className={cn(
          sizeClasses[size],
          "transition-all duration-200",
          status.hasLiked && "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
        onClick={handleLike}
        disabled={status.hasLiked || submitting || loading}
      >
        {submitting ? (
          <Loader2 className={cn(iconSizes[size], "animate-spin mr-1")} />
        ) : (
          <Heart
            className={cn(
              iconSizes[size],
              "mr-1 transition-all duration-200",
              status.hasLiked && "fill-current"
            )}
          />
        )}
        <span>
          {loading
            ? "加载中..."
            : status.hasLiked
            ? "已点赞"
            : "点赞"}
        </span>
      </Button>

      {showCount && !loading && (
        <span
          className={cn(
            "text-muted-foreground",
            size === "sm" && "text-xs",
            size === "md" && "text-sm",
            size === "lg" && "text-base"
          )}
        >
          {status.count} 人点赞
        </span>
      )}

      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
