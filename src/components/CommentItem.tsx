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
  currentUserIsAdmin: boolean;
  onDelete?: (commentId: string) => Promise<void>;
  onReply?: (parentId: string, content: string, authorName: string) => Promise<void>;
  depth?: number;
  maxDepth?: number;
}

export function CommentItem({
  comment,
  currentUserIsAdmin,
  onDelete,
  onReply,
  depth = 0,
  maxDepth = 2,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

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
  const handleReplySubmit = async (content: string, authorName: string) => {
    if (!onReply) return;

    setIsSubmitting(true);
    try {
      await onReply(comment.id, content, authorName);
      setShowReplyForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

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
        {comment.isAuthorRole && (
          <Badge variant="outline" className="border-primary/40 text-xs text-primary">
            作者
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
            className="min-h-11 text-xs"
            onClick={() => setShowReplyForm(!showReplyForm)}
          >
            <MessageCircle className="w-3.5 h-3.5 mr-1" />
            回复
          </Button>
        )}

        {currentUserIsAdmin && onDelete && (
          <>
            <Button
              variant={confirmDelete ? "destructive" : "ghost"}
              size="sm"
              className={cn("min-h-11 text-xs", !confirmDelete && "text-destructive hover:text-destructive")}
              disabled={deleting}
              onClick={async () => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                setDeleting(true);
                setDeleteError(false);
                try {
                  await onDelete(comment.id);
                } catch {
                  setDeleteError(true);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {!confirmDelete && <Trash2 className="mr-1 size-3.5" aria-hidden="true" />}
              {confirmDelete ? "确认删除" : "删除"}
            </Button>
            {confirmDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11"
                disabled={deleting}
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteError(false);
                }}
              >
                取消
              </Button>
            )}
          </>
        )}
      </div>

      {deleteError && <p role="alert" className="mt-2 text-sm text-destructive">删除评论失败，请重试。</p>}

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
            className="min-h-11 text-xs text-muted-foreground"
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
