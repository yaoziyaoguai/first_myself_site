import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await isAdmin();
  return NextResponse.json({ isAdmin: admin });
}
