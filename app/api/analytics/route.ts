import { NextRequest, NextResponse } from "next/server";
import { parseAnalyticsEvent } from "@/lib/analytics";
import { recordPageView, updatePageView } from "@/lib/analytics.server";
import { isRateLimited } from "@/lib/rateLimit";
import { readJsonObject } from "@/lib/requestBody";
import { deriveRequestIdentity } from "@/lib/requestIdentity";
import { getPayloadAPI } from "@/lib/payload";
import {
  createOwnerDeviceMarker,
  OWNER_DEVICE_COOKIE,
  verifyOwnerDeviceMarker,
} from "@/lib/analyticsOwner";

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

async function readOwnerStatus(request: NextRequest) {
  const markedOwner = verifyOwnerDeviceMarker(
    request.cookies.get(OWNER_DEVICE_COOKIE)?.value,
  );
  if (
    !request.cookies.has("payload-token") &&
    !request.headers.has("authorization")
  ) {
    return { authenticatedOwner: false, isOwner: markedOwner };
  }
  try {
    const payload = await getPayloadAPI();
    const { user } = await payload.auth({ headers: request.headers });
    const authenticatedOwner =
      user?.role === "admin" || user?.role === "editor";
    return {
      authenticatedOwner,
      isOwner: authenticatedOwner || markedOwner,
    };
  } catch {
    return { authenticatedOwner: false, isOwner: markedOwner };
  }
}

function successResponse(status: number, rememberOwner: boolean) {
  const response = NextResponse.json({ ok: true }, { status });
  const marker = rememberOwner ? createOwnerDeviceMarker() : null;
  if (marker) {
    response.cookies.set(OWNER_DEVICE_COOKIE, marker, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
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
    const owner = await readOwnerStatus(request);
    const analyticsIdentity = {
      visitorHash: identity.fingerprint,
      networkPrefix: identity.networkPrefix,
      isOwner: owner.isOwner,
    };

    if (event.event === "start") {
      const pageView = await recordPageView(event, analyticsIdentity);
      if (!pageView) return errorResponse("Analytics session conflict", 409);
      return successResponse(201, owner.authenticatedOwner);
    }

    const pageView = await updatePageView(event, analyticsIdentity);
    if (!pageView) return errorResponse("Analytics session not found", 404);
    return successResponse(200, owner.authenticatedOwner);
  } catch (error) {
    console.error("Error recording analytics:", error);
    return errorResponse("Failed to record analytics", 500);
  }
}
