"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Send, Loader2 } from "lucide-react";

interface CommentFormProps {
  onSubmit: (content: string, authorName: string, authorEmail: string) => Promise<void>;
  submitLabel?: string;
  isSubmitting?: boolean;
  compact?: boolean;
}

export function CommentForm({
  onSubmit,
  submitLabel = "发表评论",
  isSubmitting = false,
  compact = false,
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);

  const MAX_CHARS = 1000;

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARS) {
      setContent(value);
      setCharCount(value.length);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证内容
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError("评论内容不能为空");
      return;
    }

    if (trimmedContent.length > MAX_CHARS) {
      setError(`评论内容不能超过 ${MAX_CHARS} 字符`);
      return;
    }

    // 验证邮箱格式（如果提供了）
    if (authorEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(authorEmail)) {
        setError("请输入有效的邮箱地址");
        return;
      }
    }

    try {
      await onSubmit(trimmedContent, authorName.trim() || "匿名用户", authorEmail.trim());
      // 清空表单
      setContent("");
      setAuthorName("");
      setAuthorEmail("");
      setCharCount(0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请稍后重试");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-3", compact && "space-y-2")}>
      {/* 昵称和邮箱输入（仅在非紧凑模式下显示） */}
      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="authorName"
              className="block text-sm font-medium text-muted-foreground mb-1"
            >
              昵称（可选）
            </label>
            <input
              type="text"
              id="authorName"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="匿名用户"
              maxLength={30}
              className={cn(
                "w-full px-3 py-2 text-sm rounded-md border border-input bg-background",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                "placeholder:text-muted-foreground"
              )}
            />
          </div>
          <div>
            <label
              htmlFor="authorEmail"
              className="block text-sm font-medium text-muted-foreground mb-1"
            >
              邮箱（可选）
            </label>
            <input
              type="email"
              id="authorEmail"
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              placeholder="your@email.com"
              maxLength={100}
              className={cn(
                "w-full px-3 py-2 text-sm rounded-md border border-input bg-background",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                "placeholder:text-muted-foreground"
              )}
            />
          </div>
        </div>
      )}

      {/* 评论内容输入 */}
      <div>
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="写下你的评论..."
          rows={compact ? 3 : 4}
          maxLength={MAX_CHARS}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-md border border-input bg-background resize-none",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "placeholder:text-muted-foreground"
          )}
          disabled={isSubmitting}
        />
        {/* 字符计数 */}
        <div className="flex justify-between items-center mt-1">
          <span
            className={cn(
              "text-xs",
              charCount > MAX_CHARS * 0.9
                ? "text-destructive"
                : "text-muted-foreground"
            )}
          >
            {charCount} / {MAX_CHARS}
          </span>
          {compact && (
            <span className="text-xs text-muted-foreground">
              回复评论
            </span>
          )}
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {error}
        </div>
      )}

      {/* 提交按钮 */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          size={compact ? "sm" : "default"}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              提交中...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
