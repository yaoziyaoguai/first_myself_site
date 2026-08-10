"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const HEARTBEAT_MS = 15_000;
const MAX_HEARTBEAT_BACKOFF_MS = 5 * 60_000;

type PrivacyNavigator = Navigator & { globalPrivacyControl?: boolean };

function readScrollDepth() {
  const height = document.documentElement.scrollHeight;
  if (height <= 0) return 100;

  return Math.round(
    Math.min(100, ((window.scrollY + window.innerHeight) / height) * 100),
  );
}

function readReferrer() {
  if (!document.referrer) return "";

  try {
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin ? "" : referrer.origin;
  } catch {
    return "";
  }
}

async function postAnalytics(
  body: Record<string, unknown>,
  preferBeacon = false,
) {
  const serialized = JSON.stringify(body);
  if (preferBeacon && navigator.sendBeacon) {
    try {
      const queued = navigator.sendBeacon(
        "/api/analytics",
        new Blob([serialized], { type: "application/json" }),
      );
      if (queued) return true;
    } catch {
      // Beacon 不可用时继续走 keepalive fetch。
    }
  }

  try {
    const response = await fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: serialized,
      keepalive: true,
    });
    return response.ok;
  } catch {
    // 统计失败不能影响读者访问页面。
    return false;
  }
}

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const privacy = navigator as PrivacyNavigator;
    if (
      !pathname ||
      privacy.doNotTrack === "1" ||
      privacy.globalPrivacyControl === true
    ) {
      return;
    }

    const sessionId = window.crypto.randomUUID();
    const pageContext = {
      path: pathname,
      title: document.title,
      referrer: readReferrer(),
    };
    let engagedMilliseconds = 0;
    let activeSince =
      document.visibilityState === "visible" ? Date.now() : null;
    let maxScrollDepth = readScrollDepth();
    let heartbeatTimeout: number | null = null;
    let stopped = false;

    const readEngagedSeconds = () => {
      const activeMilliseconds =
        activeSince === null ? 0 : Date.now() - activeSince;
      return Math.round((engagedMilliseconds + activeMilliseconds) / 1_000);
    };

    const heartbeat = (preferBeacon = false) =>
      postAnalytics(
        {
          event: "heartbeat",
          sessionId,
          ...pageContext,
          engagedSeconds: readEngagedSeconds(),
          scrollDepth: maxScrollDepth,
        },
        preferBeacon,
      );

    const scheduleHeartbeat = (delay = HEARTBEAT_MS) => {
      if (heartbeatTimeout !== null) window.clearTimeout(heartbeatTimeout);
      heartbeatTimeout = window.setTimeout(async () => {
        const recorded = await heartbeat();
        if (stopped) return;

        scheduleHeartbeat(
          recorded
            ? HEARTBEAT_MS
            : Math.min(delay * 2, MAX_HEARTBEAT_BACKOFF_MS),
        );
      }, delay);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (activeSince !== null) {
          engagedMilliseconds += Date.now() - activeSince;
          activeSince = null;
        }
        void heartbeat(true);
      } else if (activeSince === null) {
        activeSince = Date.now();
      }
    };

    const handleScroll = () => {
      maxScrollDepth = Math.max(maxScrollDepth, readScrollDepth());
    };

    const handlePageHide = () => void heartbeat(true);

    void postAnalytics({ event: "start", sessionId, ...pageContext });

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleHeartbeat();

    return () => {
      stopped = true;
      if (heartbeatTimeout !== null) window.clearTimeout(heartbeatTimeout);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void heartbeat(true);
    };
  }, [pathname]);

  return null;
}
