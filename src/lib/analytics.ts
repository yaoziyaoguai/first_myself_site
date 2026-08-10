const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AnalyticsPageContext = {
  sessionId: string;
  path: string;
  title: string;
  referrerHost: string;
};

export type AnalyticsStartEvent = AnalyticsPageContext & {
  event: "start";
};

export type AnalyticsHeartbeatEvent = AnalyticsPageContext & {
  event: "heartbeat";
  engagedSeconds: number;
  scrollDepth: number;
};

export type AnalyticsEvent = AnalyticsStartEvent | AnalyticsHeartbeatEvent;

function readSessionId(value: unknown) {
  if (typeof value !== "string") return null;
  const sessionId = value.trim();
  return UUID_PATTERN.test(sessionId) ? sessionId : null;
}

function readPath(value: unknown) {
  if (typeof value !== "string" || value.length > 1_000) return null;

  try {
    const url = new URL(value, "https://analytics.invalid");
    if (url.origin !== "https://analytics.invalid") return null;
    return url.pathname.slice(0, 500) || "/";
  } catch {
    return null;
  }
}

function readReferrerHost(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";

  try {
    return new URL(value).hostname.slice(0, 253);
  } catch {
    return "";
  }
}

function readClampedNumber(value: unknown, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(Math.min(Math.max(value, 0), max));
}

export function parseAnalyticsEvent(value: unknown): AnalyticsEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const data = value as Record<string, unknown>;
  const sessionId = readSessionId(data.sessionId);
  if (!sessionId) return null;

  const path = readPath(data.path);
  if (!path) return null;
  const context = {
    sessionId,
    path,
    title:
      typeof data.title === "string" ? data.title.trim().slice(0, 200) : "",
    referrerHost: readReferrerHost(data.referrer),
  };

  if (data.event === "start") {
    return {
      event: "start",
      ...context,
    };
  }

  if (data.event === "heartbeat") {
    const engagedSeconds = readClampedNumber(data.engagedSeconds, 86_400);
    const scrollDepth = readClampedNumber(data.scrollDepth, 100);
    if (engagedSeconds === null || scrollDepth === null) return null;

    return {
      event: "heartbeat",
      ...context,
      engagedSeconds,
      scrollDepth,
    };
  }

  return null;
}
