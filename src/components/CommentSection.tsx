"use client";

import { useState, useEffect } from "react";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { Button } from "./ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getComments,
  createComment,
  softDeleteComment,
  type Comment,
} from "@/lib/comments";

interface CommentSectionProps {
  targetId: string;
  targetType: "blog" | "project";
  className?: string;
  initialIsAdmin: boolean;
}

export function CommentSection({
  targetId,
  targetType,
  className,
  initialIsAdmin,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // 加载评论，并在目标切换或组件卸载时忽略过期响应。
  useEffect(() => {
    let cancelled = false;

    async function loadComments() {
      try {
        const result = await getComments(targetId, targetType, 10, page);
        if (cancelled) return;

        setComments((previous) =>
          page === 1
            ? result.docs
            : [...previous, ...result.docs]
        );
        setTotalCount(result.totalDocs);
        setHasMore(result.totalPages > page);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError("加载评论失败，请稍后重试");
        console.error("Failed to load comments:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadComments();

    return () => {
      cancelled = true;
    };
  }, [targetId, targetType, page]);

  // 处理新评论提交
  const handleSubmitComment = async (
    content: string,
    authorName: string,
    authorEmail: string
  ) => {
    setSubmitting(true);
    try {
      const newComment = await createComment({
        targetId,
        targetType,
        content,
        authorName,
        authorEmail,
      });

      // 添加到列表顶部
      setComments((prev) => [{ ...newComment, replies: [] }, ...prev]);
      setTotalCount((prev) => prev + 1);
    } catch (err) {
      console.error("Failed to create comment:", err);
      throw new Error("发表评论失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  // 处理回复
  const handleReply = async (parentId: string, content: string, authorName: string) => {
    setSubmitting(true);
    try {
      const newReply = await createComment({
        targetId,
        targetType,
        parentId,
        content,
        authorName,
      });

      // 更新父评论的 replies
      setComments((prev) => updateCommentReplies(prev, parentId, newReply));
    } catch (err) {
      console.error("Failed to create reply:", err);
      throw new Error("发表回复失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  // 处理删除
  const handleDelete = async (commentId: string) => {
    await softDeleteComment(commentId);
    setComments((prev) => removeComment(prev, commentId));
    if (comments.some((comment) => comment.id === commentId)) {
      setTotalCount((prev) => prev - 1);
    }
  };

  // 加载更多评论
  const handleLoadMore = () => {
    setLoading(true);
    setError(null);
    setPage((prev) => prev + 1);
  };

  // 辅助函数：更新嵌套回复
  const updateCommentReplies = (
    comments: Comment[],
    parentId: string,
    newReply: Comment
  ): Comment[] => {
    return comments.map((comment) => {
      if (comment.id === parentId) {
        return {
          ...comment,
          replies: [...(comment.replies || []), newReply],
        };
      }
      if (comment.replies) {
        return {
          ...comment,
          replies: updateCommentReplies(comment.replies, parentId, newReply),
        };
      }
      return comment;
    });
  };

  const removeComment = (items: Comment[], commentId: string): Comment[] =>
    items
      .filter((comment) => comment.id !== commentId)
      .map((comment) => ({
        ...comment,
        replies: comment.replies
          ? removeComment(comment.replies, commentId)
          : undefined,
      }));

  return (
    <div className={cn("space-y-6", className)}>
      <h2 className="font-serif text-2xl font-medium">
        讨论与交流
        {totalCount > 0 && (
          <span className="ml-2 font-mono text-sm text-muted-foreground">({totalCount})</span>
        )}
      </h2>

      <div className="border-y border-border bg-card/45 py-6 sm:px-6">
        <CommentForm
          onSubmit={handleSubmitComment}
          isSubmitting={submitting}
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-md">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* 加载状态 */}
      {loading && page === 1 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 评论列表 */}
      {!loading && !error && comments.length === 0 ? (
        <p className="py-5 font-serif italic leading-7 text-muted-foreground">
          读完有任何不同看法、实践补充或疑问，欢迎留下你的笔记。
        </p>
      ) : (
        <div className="space-y-0">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserIsAdmin={initialIsAdmin}
              onDelete={initialIsAdmin ? handleDelete : undefined}
              onReply={handleReply}
            />
          ))}
        </div>
      )}

      {/* 加载更多 */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                加载中...
              </>
            ) : (
              "加载更多评论"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
