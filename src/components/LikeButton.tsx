"use client";

import { useState, useEffect } from "react";
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

  // 加载点赞状态，并在目标切换或组件卸载时忽略过期响应。
  useEffect(() => {
    let cancelled = false;

    async function loadLikeStatus() {
      try {
        const likeStatus = await getLikeStatus(targetId, targetType);
        if (cancelled) return;
        setStatus(likeStatus);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load like status:", err);
        setError("加载点赞状态失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLikeStatus();

    return () => {
      cancelled = true;
    };
  }, [targetId, targetType]);

  // 处理点赞
  const handleLike = async () => {
    if (status.hasLiked || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const nextStatus = await createLike({
        targetId,
        targetType,
      });

      setStatus(nextStatus);
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
    sm: "min-h-11 px-3 text-xs",
    md: "min-h-11 px-3 text-sm",
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
