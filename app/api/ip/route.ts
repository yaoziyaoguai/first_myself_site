import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 获取客户端 IP
  // 优先从 x-forwarded-for 获取（经过代理时）
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  let ip: string;

  if (forwardedFor) {
    // x-forwarded-for 可能包含多个 IP，取第一个（客户端真实 IP）
    ip = forwardedFor.split(",")[0].trim();
  } else if (realIp) {
    ip = realIp;
  } else {
    // 开发环境或直连时使用本地地址
    ip = "127.0.0.1";
  }

  return NextResponse.json({ ip });
}
