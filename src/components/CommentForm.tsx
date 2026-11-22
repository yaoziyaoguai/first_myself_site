"use client";

import { useId, useState } from "react";
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
  const nameId = useId();
  const emailId = useId();
  const charCount = content.length;

  const MAX_CHARS = 1000;

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARS) {
      setContent(value);
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
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请稍后重试");
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className={cn("space-y-3", compact && "space-y-2")}>
      <div className={cn("grid gap-3", !compact && "sm:grid-cols-2")}>
          <div>
            <label
              htmlFor={nameId}
              className="block text-sm font-medium text-muted-foreground mb-1"
            >
              昵称（可选）
            </label>
            <input
              type="text"
              id={nameId}
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="匿名用户"
              maxLength={30}
              className={cn(
                "min-h-11 w-full border border-border bg-card px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
                "placeholder:text-foreground/50"
              )}
            />
          </div>
          {!compact && <div>
            <label
              htmlFor={emailId}
              className="block text-sm font-medium text-muted-foreground mb-1"
            >
              邮箱（可选）
            </label>
            <input
              type="email"
              id={emailId}
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              placeholder="your@email.com"
              maxLength={100}
              className={cn(
                "min-h-11 w-full border border-border bg-card px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
                "placeholder:text-foreground/50"
              )}
            />
          </div>}
      </div>

      {/* 评论内容输入 */}
      <div>
        <textarea
          value={content}
          onChange={handleContentChange}
          aria-label={compact ? "回复内容" : "评论内容"}
          placeholder="写下你的评论..."
          rows={compact ? 3 : 4}
          maxLength={MAX_CHARS}
          className={cn(
            "w-full resize-y border border-border bg-card px-3 py-3 text-sm leading-6",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            "placeholder:text-foreground/50"
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
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div role="alert" className="border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive">
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
