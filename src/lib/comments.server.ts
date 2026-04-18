import { getPayloadAPI } from "./payload";
import type { Comment, CreateCommentData } from "./comments";

/**
 * 服务端专用：查询顶层评论（parentId 为 null）
 * 按时间倒序排列
 */
export async function getComments(
  targetId: string,
  targetType: "blog" | "project",
  limit: number = 10,
  page: number = 1
): Promise<{ docs: Comment[]; totalDocs: number; totalPages: number }> {
  const payload = await getPayloadAPI();

  const result = await payload.find({
    collection: "comments",
    where: {
      targetId: { equals: targetId },
      targetType: { equals: targetType },
      isDeleted: { equals: false },
      // parentId 为 null 或不存在表示顶层评论
      parentId: { exists: false },
    },
    sort: "-createdAt",
    limit,
    page,
  });

  return {
    docs: result.docs as unknown as Comment[],
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
  };
}

/**
 * 服务端专用：查询指定评论的回复
 * 按时间正序排列（先回复的在前）
 */
export async function getReplies(parentId: string): Promise<Comment[]> {
  const payload = await getPayloadAPI();

  const result = await payload.find({
    collection: "comments",
    where: {
      parentId: { equals: parentId },
      isDeleted: { equals: false },
    },
    sort: "createdAt", // 正序
    limit: 100,
  });

  return result.docs as unknown as Comment[];
}

/**
 * 服务端专用：创建新评论
 */
export async function createComment(data: CreateCommentData): Promise<Comment> {
  const payload = await getPayloadAPI();

  const result = await payload.create({
    collection: "comments",
    data: {
      targetId: data.targetId,
      targetType: data.targetType,
      parentId: data.parentId || undefined,
      content: data.content,
      authorName: data.authorName || "匿名用户",
      authorEmail: data.authorEmail || "",
      ipHash: data.ipHash,
      fingerprint: data.fingerprint || "",
      isDeleted: false,
    },
  });

  return result as unknown as Comment;
}

/**
 * 服务端专用：软删除评论
 * 仅管理员可调用
 */
export async function softDeleteComment(
  commentId: string,
  deletedBy: string = "admin"
): Promise<Comment> {
  const payload = await getPayloadAPI();

  const result = await payload.update({
    collection: "comments",
    id: commentId,
    data: {
      isDeleted: true,
      deletedBy,
    },
  });

  return result as unknown as Comment;
}

/**
 * 服务端专用：获取评论数量统计
 */
export async function getCommentCount(
  targetId: string,
  targetType: "blog" | "project"
): Promise<number> {
  const result = await getComments(targetId, targetType, 1, 1);
  return result.totalDocs;
}
