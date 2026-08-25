import { NextRequest, NextResponse } from "next/server";
import { parseAnalyticsEvent } from "@/lib/analytics";
import { recordPageView, updatePageView } from "@/lib/analytics.server";
import { isRateLimited } from "@/lib/rateLimit";
import { readJsonObject } from "@/lib/requestBody";
import { deriveRequestIdentity } from "@/lib/requestIdentity";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function expectedOrigin(request: NextRequest) {
  try {
    return new URL(process.env.NEXT_PUBLIC_SERVER_URL || request.nextUrl.origin)
      .origin;
  } catch {
    return request.nextUrl.origin;
  }
}

async function isOwnerRequest(request: NextRequest) {
  if (
    !request.cookies.has("payload-token") &&
    !request.headers.has("authorization")
  ) {
    return false;
  }
  try {
    const payload = await getPayloadAPI();
    const { user } = await payload.auth({ headers: request.headers });
    return user?.role === "admin" || user?.role === "editor";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== expectedOrigin(request)) {
    return errorResponse("Forbidden origin", 403);
  }
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return errorResponse("Content-Type must be application/json", 415);
  }

  const body = await readJsonObject(request);
  const event = parseAnalyticsEvent(body);
  if (!event) return errorResponse("Invalid analytics event", 400);

  try {
    const identity = deriveRequestIdentity(request);
    const limit = event.event === "start" ? 120 : 2_000;
    if (
      isRateLimited(
        `analytics:${event.event}:${identity.rateLimitKey}`,
        limit,
        60 * 60 * 1000,
      )
    ) {
      return errorResponse("Too many requests", 429);
    }
    const analyticsIdentity = {
      visitorHash: identity.fingerprint,
      networkPrefix: identity.networkPrefix,
      isOwner: await isOwnerRequest(request),
    };

    if (event.event === "start") {
      const pageView = await recordPageView(event, analyticsIdentity);
      if (!pageView) return errorResponse("Analytics session conflict", 409);
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    const pageView = await updatePageView(event, analyticsIdentity);
    if (!pageView) return errorResponse("Analytics session not found", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error recording analytics:", error);
    return errorResponse("Failed to record analytics", 500);
  }
}
