import { NextResponse } from "next/server";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getPayloadAPI();
    await payload.find({
      collection: "users",
      limit: 1,
      depth: 0,
      overrideAccess: true,
      select: { id: true },
    });
    return NextResponse.json({ status: "ready" });
  } catch {
    console.error("Application health check failed");
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
