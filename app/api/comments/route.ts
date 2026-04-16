import { NextRequest, NextResponse } from "next/server";
import {
  getComments,
  getReplies,
  createComment,
  softDeleteComment,
} from "@/lib/comments";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/comments?targetId=xxx&targetType=xxx&page=1
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get("targetId");
    const targetType = searchParams.get("targetType") as "blog" | "project" | null;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const parentId = searchParams.get("parentId");

    if (!targetId || !targetType) {
      return NextResponse.json(
        { error: "Missing targetId or targetType" },
        { status: 400 }
      );
    }

    if (parentId) {
      // 获取回复
      const replies = await getReplies(parentId);
      return NextResponse.json({ docs: replies });
    }

    // 获取顶层评论
    const result = await getComments(targetId, targetType, 10, page);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

// POST /api/comments - 创建评论
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // 验证必要字段
    if (!data.content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    if (!data.targetId || !data.targetType) {
      return NextResponse.json(
        { error: "targetId and targetType are required" },
        { status: 400 }
      );
    }

    if (!data.ipHash) {
      return NextResponse.json(
        { error: "ipHash is required" },
        { status: 400 }
      );
    }

    const comment = await createComment({
      targetId: data.targetId,
      targetType: data.targetType,
      parentId: data.parentId || null,
      content: data.content.trim(),
      authorName: data.authorName?.trim() || "匿名用户",
      authorEmail: data.authorEmail?.trim() || "",
      ipHash: data.ipHash,
      fingerprint: data.fingerprint || "",
    });

    return NextResponse.json(comment);
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}

// PATCH /api/comments?id=xxx - 软删除评论
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Comment ID is required" },
        { status: 400 }
      );
    }

    // 检查是否为管理员
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const comment = await softDeleteComment(id, "admin");
    return NextResponse.json(comment);
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
