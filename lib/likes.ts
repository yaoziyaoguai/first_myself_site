export interface Like {
  id: string;
  targetId: string;
  targetType: "blog" | "project";
  ipHash: string;
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLikeData {
  targetId: string;
  targetType: "blog" | "project";
  ipHash: string;
  fingerprint: string;
}

export interface LikeStatus {
  count: number;
  hasLiked: boolean;
}

/**
 * 获取点赞状态
 * 包括点赞总数和当前用户是否已点赞
 */
export async function getLikeStatus(
  targetId: string,
  targetType: "blog" | "project",
  ipHash: string,
  fingerprint: string
): Promise<LikeStatus> {
  const params = new URLSearchParams({
    targetId,
    targetType,
    ipHash,
    fingerprint,
  });

  const response = await fetch(`/api/likes?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch like status");
  }

  return response.json();
}

/**
 * 创建新点赞
 */
export async function createLike(data: CreateLikeData): Promise<Like> {
  const response = await fetch("/api/likes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create like");
  }

  return response.json();
}

/**
 * 获取点赞数量
 */
export async function getLikeCount(
  targetId: string,
  targetType: "blog" | "project"
): Promise<number> {
  const status = await getLikeStatus(targetId, targetType, "", "");
  return status.count;
}

/**
 * 检查用户是否已点赞
 */
export async function hasLiked(
  targetId: string,
  targetType: "blog" | "project",
  ipHash: string,
  fingerprint: string
): Promise<boolean> {
  const status = await getLikeStatus(targetId, targetType, ipHash, fingerprint);
  return status.hasLiked;
}
