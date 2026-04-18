export interface Comment {
  id: string;
  targetId: string;
  targetType: "blog" | "project";
  parentId?: string | null;
  content: string;
  authorName: string;
  authorEmail?: string;
  ipHash: string;
  fingerprint?: string;
  isDeleted: boolean;
  deletedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
}

export interface CreateCommentData {
  targetId: string;
  targetType: "blog" | "project";
  parentId?: string | null;
  content: string;
  authorName?: string;
  authorEmail?: string;
  ipHash: string;
  fingerprint?: string;
}

/**
 * 获取 API 基础 URL
 * 服务端使用绝对 URL，浏览器端使用相对路径
 */
function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    // Server-side: use absolute URL
    return process.env.NEXT_PUBLIC_SERVER_URL || "https://wangjinkun333.me";
  }
  // Browser-side: relative path works fine
  return "";
}

/**
 * 查询顶层评论（parentId 为 null）
 * 按时间倒序排列
 */
export async function getComments(
  targetId: string,
  targetType: "blog" | "project",
  limit: number = 10,
  page: number = 1
): Promise<{ docs: Comment[]; totalDocs: number; totalPages: number }> {
  const params = new URLSearchParams({
    targetId,
    targetType,
    page: page.toString(),
  });

  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/comments?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch comments");
  }

  return response.json();
}

/**
 * 查询指定评论的回复
 * 按时间正序排列（先回复的在前）
 */
export async function getReplies(parentId: string): Promise<Comment[]> {
  const params = new URLSearchParams({
    targetId: "dummy", // required by API
    targetType: "blog", // required by API
    parentId,
  });

  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/comments?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch replies");
  }

  const data = await response.json();
  return data.docs;
}

/**
 * 创建新评论
 */
export async function createComment(data: CreateCommentData): Promise<Comment> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create comment");
  }

  return response.json();
}

/**
 * 软删除评论
 * 仅管理员可调用
 */
export async function softDeleteComment(
  commentId: string,
  _deletedBy: string = "admin"
): Promise<Comment> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/comments?id=${commentId}`, {
    method: "PATCH",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete comment");
  }

  return response.json();
}

/**
 * 获取评论数量统计
 */
export async function getCommentCount(
  targetId: string,
  targetType: "blog" | "project"
): Promise<number> {
  // 使用 getComments 获取第一页，返回总数
  const result = await getComments(targetId, targetType, 1, 1);
  return result.totalDocs;
}

/**
 * 将扁平的评论列表组装为树形结构
 * 限制最大层级为 5 层（防止无限递归）
 */
export function buildCommentTree(
  comments: Comment[],
  maxDepth: number = 5,
  currentDepth: number = 0
): Comment[] {
  if (currentDepth >= maxDepth) {
    return comments;
  }

  // 分离顶层评论和回复
  const topLevel = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => c.parentId);

  // 为每个顶层评论附加回复
  return topLevel.map((comment) => ({
    ...comment,
    replies: replies.filter((r) => r.parentId === comment.id),
  }));
}
