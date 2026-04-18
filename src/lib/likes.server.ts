import { getPayloadAPI } from "./payload";
import type { Like, CreateLikeData, LikeStatus } from "./likes";

/**
 * 服务端专用：获取点赞状态
 * 包括点赞总数和当前用户是否已点赞
 */
export async function getLikeStatus(
  targetId: string,
  targetType: "blog" | "project",
  ipHash: string,
  fingerprint: string
): Promise<LikeStatus> {
  const payload = await getPayloadAPI();

  // 获取总点赞数
  const countResult = await payload.find({
    collection: "likes",
    where: {
      targetId: { equals: targetId },
      targetType: { equals: targetType },
    },
    limit: 0, // 只需要总数
  });

  const count = countResult.totalDocs;

  // 如果提供了 ipHash 和 fingerprint，检查用户是否已点赞
  let hasLiked = false;
  if (ipHash && fingerprint) {
    const userLikeResult = await payload.find({
      collection: "likes",
      where: {
        targetId: { equals: targetId },
        targetType: { equals: targetType },
        ipHash: { equals: ipHash },
        fingerprint: { equals: fingerprint },
      },
      limit: 1,
    });
    hasLiked = userLikeResult.totalDocs > 0;
  }

  return { count, hasLiked };
}

/**
 * 服务端专用：创建新点赞
 */
export async function createLike(data: CreateLikeData): Promise<Like> {
  const payload = await getPayloadAPI();

  // 先检查是否已点赞
  const existingLike = await payload.find({
    collection: "likes",
    where: {
      targetId: { equals: data.targetId },
      targetType: { equals: data.targetType },
      ipHash: { equals: data.ipHash },
      fingerprint: { equals: data.fingerprint },
    },
    limit: 1,
  });

  if (existingLike.totalDocs > 0) {
    throw new Error("您已经点赞过了");
  }

  const result = await payload.create({
    collection: "likes",
    data: {
      targetId: data.targetId,
      targetType: data.targetType,
      ipHash: data.ipHash,
      fingerprint: data.fingerprint,
    },
  });

  return result as unknown as Like;
}

/**
 * 服务端专用：获取点赞数量
 */
export async function getLikeCount(
  targetId: string,
  targetType: "blog" | "project"
): Promise<number> {
  const payload = await getPayloadAPI();

  const result = await payload.find({
    collection: "likes",
    where: {
      targetId: { equals: targetId },
      targetType: { equals: targetType },
    },
    limit: 0,
  });

  return result.totalDocs;
}
