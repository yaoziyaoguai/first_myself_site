import { SITE_URL } from "@/content/siteDefaults";

export interface LikeStatus {
  count: number;
  hasLiked: boolean;
}

export interface CreateLikeData {
  targetId: string;
  targetType: "blog" | "project";
}

function getApiBaseUrl(): string {
  return typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_SERVER_URL || SITE_URL
    : "";
}

export async function getLikeStatus(
  targetId: string,
  targetType: "blog" | "project",
): Promise<LikeStatus> {
  const params = new URLSearchParams({ targetId, targetType });
  const response = await fetch(`${getApiBaseUrl()}/api/likes?${params}`);
  if (!response.ok) throw new Error("Failed to fetch like status");
  return response.json();
}

export async function createLike(data: CreateLikeData): Promise<LikeStatus> {
  const response = await fetch(`${getApiBaseUrl()}/api/likes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create like");
  }
  return response.json();
}

export async function getLikeCount(
  targetId: string,
  targetType: "blog" | "project",
): Promise<number> {
  return (await getLikeStatus(targetId, targetType)).count;
}

export async function hasLiked(
  targetId: string,
  targetType: "blog" | "project",
): Promise<boolean> {
  return (await getLikeStatus(targetId, targetType)).hasLiked;
}
