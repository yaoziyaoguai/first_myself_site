import { NextRequest, NextResponse } from "next/server";
import { isInteractionTargetType } from "@/lib/interactionTarget";
import { targetExists } from "@/lib/interactionTarget.server";
import { createLike, getLikeCount, getLikeStatus } from "@/lib/likes.server";
import { isRateLimited } from "@/lib/rateLimit";
import { readJsonObject } from "@/lib/requestBody";
import { deriveRequestIdentity } from "@/lib/requestIdentity";

export const dynamic = "force-dynamic";

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function readTarget(data: Record<string, unknown>) {
  const targetId = typeof data.targetId === "string" ? data.targetId.trim() : "";
  const targetType = data.targetType;
  if (!targetId || targetId.length > 128 || !isInteractionTargetType(targetType)) {
    return null;
  }
  return { targetId, targetType };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = readTarget({
    targetId: searchParams.get("targetId"),
    targetType: searchParams.get("targetType"),
  });
  if (!target) return errorResponse("Invalid target", 400);

  try {
    if (!(await targetExists(target.targetId, target.targetType))) {
      return errorResponse("Target not found", 404);
    }
    const identity = deriveRequestIdentity(request);
    return NextResponse.json(await getLikeStatus(target.targetId, target.targetType, identity));
  } catch (error) {
    console.error("Error fetching like status:", error);
    return errorResponse("Failed to fetch like status", 500);
  }
}

export async function POST(request: NextRequest) {
  const data = await readJsonObject(request);
  if (!data) return errorResponse("Invalid JSON body", 400);
  const target = readTarget(data);
  if (!target) return errorResponse("Invalid target", 400);

  try {
    const identity = deriveRequestIdentity(request);
    if (isRateLimited(`like:${identity.rateLimitKey}`, 20, 10 * 60 * 1000)) {
      return errorResponse("Too many requests. Please try again later.", 429);
    }
    if (!(await targetExists(target.targetId, target.targetType))) {
      return errorResponse("Target not found", 404);
    }

    await createLike({
      ...target,
      ipHash: identity.ipHash,
      fingerprint: identity.fingerprint,
    });
    const count = await getLikeCount(target.targetId, target.targetType);
    return NextResponse.json({ count, hasLiked: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "LIKE_ALREADY_EXISTS") {
      return errorResponse("您已经点赞过了", 409);
    }
    console.error("Error creating like:", error);
    return errorResponse("Failed to create like", 500);
  }
}
