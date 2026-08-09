import { NextResponse } from "next/server";
import { getPayloadAPI } from "@/lib/payload";
import { seedDevelopmentContent } from "@/payload/seedDevelopmentContent";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
  }

  const expectedToken = process.env.ADMIN_SECRET_TOKEN;
  const authorization = request.headers.get("Authorization");
  if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
    return NextResponse.json(
      { error: "Unauthorized: missing or invalid token" },
      { status: 401 },
    );
  }

  try {
    const payload = await getPayloadAPI();
    const results = await seedDevelopmentContent(payload);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
