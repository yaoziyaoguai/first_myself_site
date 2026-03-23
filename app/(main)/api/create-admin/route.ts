import { getPayloadAPI } from "@/lib/payload";
import { NextResponse } from "next/server";

/**
 * GET /api/create-admin — 创建或重置管理员账号
 * 需要环境变量: ADMIN_SECRET_TOKEN (安全验证)
 * 不允许在生产环境使用
 */
export async function GET(request: Request) {
  // 生产环境绝对禁止
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
  }

  // 验证管理员密钥
  const adminToken = request.headers.get("Authorization");
  const expectedToken = `Bearer ${process.env.ADMIN_SECRET_TOKEN}`;
  if (!adminToken || adminToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized: missing or invalid token" }, { status: 401 });
  }

  const payload = await getPayloadAPI();

  // 从环境变量读取凭证，必须由部署者提供
  const email = process.env.PAYLOAD_INITIAL_ADMIN_EMAIL;
  const password = process.env.PAYLOAD_INITIAL_ADMIN_PASSWORD;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Environment variables PAYLOAD_INITIAL_ADMIN_EMAIL and PAYLOAD_INITIAL_ADMIN_PASSWORD are required" },
      { status: 500 }
    );
  }

  try {
    // 查找是否已有该邮箱的用户
    const existing = await payload.find({
      collection: "users",
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    });

    if (existing.totalDocs > 0) {
      // 更新密码和角色
      await payload.update({
        collection: "users",
        id: existing.docs[0].id,
        data: { password, role: "admin" },
        overrideAccess: true,
      });
      return NextResponse.json({
        message: `管理员密码已重置`,
        email,
        password,
      });
    }

    // 创建新用户
    await payload.create({
      collection: "users",
      data: { email, password, role: "admin" },
      overrideAccess: true,
    });

    return NextResponse.json({
      message: `管理员已创建`,
      email,
      password,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
