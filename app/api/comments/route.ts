import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import {
  createComment,
  getComments,
  getReplies,
  softDeleteComment,
} from "@/lib/comments.server";
import { isInteractionTargetType } from "@/lib/interactionTarget";
import {
  parentMatchesTarget,
  targetExists,
} from "@/lib/interactionTarget.server";
import { isRateLimited } from "@/lib/rateLimit";
import { readJsonObject } from "@/lib/requestBody";
import { deriveRequestIdentity } from "@/lib/requestIdentity";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get("targetId")?.trim() ?? "";
    const targetType = searchParams.get("targetType");
    const parentId = searchParams.get("parentId")?.trim() ?? "";
    const requestedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 1000)
      : 1;

    if (!targetId || !isInteractionTargetType(targetType)) {
      return errorResponse("Invalid target", 400);
    }

    if (parentId) {
      if (!(await parentMatchesTarget(parentId, targetId, targetType))) {
        return errorResponse("Parent comment not found", 404);
      }
      return NextResponse.json({ docs: await getReplies(parentId) });
    }

    if (!(await targetExists(targetId, targetType))) {
      return errorResponse("Target not found", 404);
    }
    return NextResponse.json(await getComments(targetId, targetType, 10, page));
  } catch (error) {
    console.error("Error fetching comments:", error);
    return errorResponse("Failed to fetch comments", 500);
  }
}

export async function POST(request: NextRequest) {
  const data = await readJsonObject(request);
  if (!data) return errorResponse("Invalid JSON body", 400);

  const targetId = typeof data.targetId === "string" ? data.targetId.trim() : "";
  const targetType = data.targetType;
  const content = typeof data.content === "string" ? data.content.trim() : "";
  const authorName =
    typeof data.authorName === "string" && data.authorName.trim()
      ? data.authorName.trim().slice(0, 80)
      : "匿名用户";
  const authorEmail =
    typeof data.authorEmail === "string" ? data.authorEmail.trim() : "";
  const parentId = typeof data.parentId === "string" ? data.parentId.trim() : "";

  if (!targetId || targetId.length > 128 || !isInteractionTargetType(targetType)) {
    return errorResponse("Invalid target", 400);
  }
  if (!content || content.length > 1000) {
    return errorResponse("Content must contain 1 to 1000 characters", 400);
  }
  if (authorEmail && (authorEmail.length > 254 || !EMAIL_PATTERN.test(authorEmail))) {
    return errorResponse("Invalid email", 400);
  }
  if (parentId.length > 128) return errorResponse("Invalid parent comment", 400);

  try {
    const identity = deriveRequestIdentity(request);
    if (isRateLimited(`comment:${identity.rateLimitKey}`, 5, 10 * 60 * 1000)) {
      return errorResponse("Too many comments. Please try again later.", 429);
    }
    if (!(await targetExists(targetId, targetType))) {
      return errorResponse("Target not found", 404);
    }
    if (
      parentId &&
      !(await parentMatchesTarget(parentId, targetId, targetType))
    ) {
      return errorResponse("Parent comment not found", 404);
    }

    const comment = await createComment({
      targetId,
      targetType,
      parentId: parentId || null,
      content,
      authorName,
      authorEmail,
      ipHash: identity.ipHash,
      fingerprint: identity.fingerprint,
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return errorResponse("Failed to create comment", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return errorResponse("Comment ID is required", 400);
  if (!(await isAdmin())) return errorResponse("Unauthorized", 403);

  try {
    return NextResponse.json(await softDeleteComment(id));
  } catch (error) {
    console.error("Error deleting comment:", error);
    return errorResponse("Failed to delete comment", 500);
  }
}
