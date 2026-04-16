"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import type { Comment } from "@/lib/comments";
import { Trash2, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { CommentForm } from "./CommentForm";

interface CommentItemProps {
  comment: Comment;
  isAuthor: boolean;
  currentUserIsAdmin: boolean;
  onDelete?: (commentId: string) => void;
  onReply?: (parentId: string, content: string) => Promise<void>;
  depth?: number;
  maxDepth?: number;
}

export function CommentItem({
  comment,
  isAuthor,
  currentUserIsAdmin,
  onDelete,
  onReply,
  depth = 0,
  maxDepth = 5,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 处理回复提交
  const handleReplySubmit = async (content: string) => {
    if (!onReply) return;

    setIsSubmitting(true);
    try {
      await onReply(comment.id, content);
      setShowReplyForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 已删除的评论
  if (comment.isDeleted) {
    return (
      <div
        className={cn(
          "py-4 border-b border-border/50",
          depth > 0 && "ml-6 pl-4 border-l-2 border-l-border/30"
        )}
      >
        <p className="text-sm text-muted-foreground italic">
          评论已删除
          {comment.deletedBy && `（由 ${comment.deletedBy} 删除）`}
        </p>
      </div>
    );
  }

  const hasReplies = comment.replies && comment.replies.length > 0;
  const canReply = depth < maxDepth - 1; // 限制回复层级

  return (
    <div
      className={cn(
        "py-4",
        depth > 0 && "ml-6 pl-4 border-l-2 border-l-border/30"
      )}
    >
      {/* 评论头部 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium text-sm">{comment.authorName}</span>
        {isAuthor && (
          <Badge variant="secondary" className="text-xs">
            博主
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {formatTime(comment.createdAt)}
        </span>
      </div>

      {/* 评论内容 */}
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
        {comment.content}
      </p>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 mt-3">
        {canReply && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowReplyForm(!showReplyForm)}
          >
            <MessageCircle className="w-3.5 h-3.5 mr-1" />
            回复
          </Button>
        )}

        {currentUserIsAdmin && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => onDelete(comment.id)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            删除
          </Button>
        )}
      </div>

      {/* 回复表单 */}
      {showReplyForm && (
        <div className="mt-3">
          <CommentForm
            onSubmit={handleReplySubmit}
            submitLabel="发表回复"
            isSubmitting={isSubmitting}
            compact
          />
        </div>
      )}

      {/* 回复列表 */}
      {hasReplies && (
        <div className="mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => setShowReplies(!showReplies)}
          >
            {showReplies ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 mr-1" />
                收起 {comment.replies?.length} 条回复
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 mr-1" />
                展开 {comment.replies?.length} 条回复
              </>
            )}
          </Button>

          {showReplies && (
            <div className="mt-2">
              {comment.replies?.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  isAuthor={reply.ipHash === comment.ipHash && reply.authorName === "博主"} // 简化判断，实际应通过用户身份
                  currentUserIsAdmin={currentUserIsAdmin}
                  onDelete={onDelete}
                  onReply={onReply}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
