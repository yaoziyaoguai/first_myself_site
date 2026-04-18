"use client";

import { useState, useEffect, useCallback } from "react";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { MessageSquare, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getComments,
  getReplies,
  createComment,
  softDeleteComment,
  type Comment,
} from "@/lib/comments";

interface CommentSectionProps {
  targetId: string;
  targetType: "blog" | "project";
  className?: string;
}

export function CommentSection({
  targetId,
  targetType,
  className,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // 加载评论
  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getComments(targetId, targetType, 10, page);

      // 为每个顶层评论加载回复（第一批）
      const commentsWithReplies = await Promise.all(
        result.docs.map(async (comment) => {
          const replies = await getReplies(comment.id);
          return { ...comment, replies };
        })
      );

      if (page === 1) {
        setComments(commentsWithReplies);
      } else {
        setComments((prev) => [...prev, ...commentsWithReplies]);
      }

      setTotalCount(result.totalDocs);
      setHasMore(result.totalPages > page);
    } catch (err) {
      setError("加载评论失败，请稍后重试");
      console.error("Failed to load comments:", err);
    } finally {
      setLoading(false);
    }
  }, [targetId, targetType, page]);

  // 检查当前用户是否是管理员
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/auth/check");
        if (response.ok) {
          const data = await response.json();
          setCurrentUserIsAdmin(data.isAdmin);
        }
      } catch (_e) {
        // 忽略错误，默认为非管理员
        setCurrentUserIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  // 初始加载
  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // 处理新评论提交
  const handleSubmitComment = async (
    content: string,
    authorName: string,
    authorEmail: string
  ) => {
    setSubmitting(true);
    try {
      // 获取 IP 哈希和指纹（简化实现）
      const ipHash = await getClientIpHash();
      const fingerprint = getBrowserFingerprint();

      const newComment = await createComment({
        targetId,
        targetType,
        content,
        authorName,
        authorEmail,
        ipHash,
        fingerprint,
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
  const handleReply = async (parentId: string, content: string) => {
    setSubmitting(true);
    try {
      const ipHash = await getClientIpHash();
      const fingerprint = getBrowserFingerprint();

      // 获取父评论信息以填充作者名
      const parentComment = findCommentById(comments, parentId);

      const newReply = await createComment({
        targetId,
        targetType,
        parentId,
        content,
        authorName: "匿名用户", // 回复时简化，使用默认名
        ipHash,
        fingerprint,
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
    if (!confirm("确定要删除这条评论吗？")) {
      return;
    }

    try {
      await softDeleteComment(commentId);

      // 更新本地状态
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? { ...comment, isDeleted: true, deletedBy: "admin" }
            : comment
        )
      );
    } catch (err) {
      console.error("Failed to delete comment:", err);
      alert("删除评论失败，请稍后重试");
    }
  };

  // 加载更多评论
  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  // 辅助函数：在嵌套结构中查找评论
  const findCommentById = (
    comments: Comment[],
    id: string
  ): Comment | null => {
    for (const comment of comments) {
      if (comment.id === id) return comment;
      if (comment.replies) {
        const found = findCommentById(comment.replies, id);
        if (found) return found;
      }
    }
    return null;
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

  // 获取客户端 IP 哈希（简化实现）
  const getClientIpHash = async () => {
    try {
      // 尝试从 API 获取 IP
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

  // 检查当前用户是否是某条评论的作者（简化：检查 IP 哈希匹配）
  // 实际应该检查用户登录状态
  const checkIsAuthor = (comment: Comment): boolean => {
    // 这里简化处理，实际应该通过用户身份判断
    // 如果评论的 fingerprint 匹配当前浏览器，认为是作者
    return false; // 简化：匿名用户不显示自己是作者
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        <h3 className="text-lg font-semibold">
          评论
          {totalCount > 0 && (
            <span className="text-muted-foreground ml-2">({totalCount})</span>
          )}
        </h3>
      </div>

      <Separator />

      {/* 评论表单 */}
      <div className="bg-muted/30 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-3">发表评论</h4>
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
      {!loading && comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无评论，来发表第一条评论吧！</p>
        </div>
      ) : (
        <div className="space-y-0">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isAuthor={checkIsAuthor(comment)}
              currentUserIsAdmin={currentUserIsAdmin}
              onDelete={currentUserIsAdmin ? handleDelete : undefined}
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
