import { SITE_URL } from "@/content/siteDefaults";

export interface Comment {
  id: string;
  targetId: string;
  targetType: "blog" | "project";
  parentId?: string | null;
  content: string;
  authorName: string;
  createdAt: string;
  replies?: Comment[];
}

export interface CreateCommentData {
  targetId: string;
  targetType: "blog" | "project";
  parentId?: string | null;
  content: string;
  authorName?: string;
  authorEmail?: string;
}

export interface CommentPage {
  docs: Comment[];
  totalDocs: number;
  totalPages: number;
  page?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

function getApiBaseUrl(): string {
  return typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_SERVER_URL || SITE_URL
    : "";
}

export async function getComments(
  targetId: string,
  targetType: "blog" | "project",
  _limit = 10,
  page = 1,
): Promise<CommentPage> {
  // 页面大小由公开 API 固定上限，保留参数以兼容现有调用接口。
  void _limit;
  const params = new URLSearchParams({ targetId, targetType, page: String(page) });
  const response = await fetch(`${getApiBaseUrl()}/api/comments?${params}`);
  if (!response.ok) throw new Error("Failed to fetch comments");
  return response.json();
}

export async function getReplies(
  parentId: string,
  targetId: string,
  targetType: "blog" | "project",
): Promise<Comment[]> {
  const params = new URLSearchParams({ targetId, targetType, parentId });
  const response = await fetch(`${getApiBaseUrl()}/api/comments?${params}`);
  if (!response.ok) throw new Error("Failed to fetch replies");
  const data = await response.json();
  return data.docs;
}

export async function createComment(data: CreateCommentData): Promise<Comment> {
  const response = await fetch(`${getApiBaseUrl()}/api/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create comment");
  }
  return response.json();
}

export async function softDeleteComment(commentId: string): Promise<{ id: string }> {
  const response = await fetch(`${getApiBaseUrl()}/api/comments?id=${commentId}`, {
    method: "PATCH",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete comment");
  }
  return response.json();
}

export async function getCommentCount(
  targetId: string,
  targetType: "blog" | "project",
): Promise<number> {
  return (await getComments(targetId, targetType, 1, 1)).totalDocs;
}

export function buildCommentTree(
  comments: Comment[],
  maxDepth = 5,
  currentDepth = 0,
): Comment[] {
  if (currentDepth >= maxDepth) return comments;
  const topLevel = comments.filter((comment) => !comment.parentId);
  const replies = comments.filter((comment) => comment.parentId);
  return topLevel.map((comment) => ({
    ...comment,
    replies: replies.filter((reply) => reply.parentId === comment.id),
  }));
}
