import { NextRequest, NextResponse } from "next/server";
import { getLikeStatus, createLike } from "@/lib/likes";

export const dynamic = "force-dynamic";

// GET /api/likes?targetId=xxx&targetType=xxx&ipHash=xxx&fingerprint=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get("targetId");
    const targetType = searchParams.get("targetType") as "blog" | "project" | null;
    const ipHash = searchParams.get("ipHash");
    const fingerprint = searchParams.get("fingerprint");

    if (!targetId || !targetType) {
      return NextResponse.json(
        { error: "Missing targetId or targetType" },
        { status: 400 }
      );
    }

    const status = await getLikeStatus(
      targetId,
      targetType,
      ipHash || "",
      fingerprint || ""
    );

    return NextResponse.json(status);
  } catch (error) {
    console.error("Error fetching like status:", error);
    return NextResponse.json(
      { error: "Failed to fetch like status" },
      { status: 500 }
    );
  }
}

// POST /api/likes - 创建点赞
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // 验证必要字段
    if (!data.targetId || !data.targetType) {
      return NextResponse.json(
        { error: "targetId and targetType are required" },
        { status: 400 }
      );
    }

    if (!data.ipHash || !data.fingerprint) {
      return NextResponse.json(
        { error: "ipHash and fingerprint are required" },
        { status: 400 }
      );
    }

    const like = await createLike({
      targetId: data.targetId,
      targetType: data.targetType,
      ipHash: data.ipHash,
      fingerprint: data.fingerprint,
    });

    return NextResponse.json(like);
  } catch (error) {
    console.error("Error creating like:", error);

    // 检查是否为重复点赞错误
    if (error instanceof Error && error.message.includes("已经点赞")) {
      return NextResponse.json(
        { error: "您已经点赞过了" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create like" },
      { status: 500 }
    );
  }
}
