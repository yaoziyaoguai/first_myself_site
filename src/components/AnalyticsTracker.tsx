"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const HEARTBEAT_MS = 15_000;
const MAX_HEARTBEAT_BACKOFF_MS = 5 * 60_000;
const ANALYTICS_OPT_OUT_KEY = "site-analytics-opt-out";

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
    const explicitOptOut = new URLSearchParams(window.location.search)
      .get("analytics") === "off";
    let tabOptedOut = explicitOptOut;
    try {
      if (explicitOptOut) {
        window.sessionStorage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
      }
      tabOptedOut =
        tabOptedOut ||
        window.sessionStorage.getItem(ANALYTICS_OPT_OUT_KEY) === "1";
    } catch {
      // 禁用 sessionStorage 时，本次 URL 的显式退出仍然有效。
    }
    if (
      !pathname ||
      tabOptedOut ||
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
      document.visibilityState === "visible" && document.hasFocus()
        ? Date.now()
        : null;
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

    const stopHeartbeat = () => {
      if (heartbeatTimeout !== null) window.clearTimeout(heartbeatTimeout);
      heartbeatTimeout = null;
    };

    const scheduleHeartbeat = (delay = HEARTBEAT_MS) => {
      if (stopped || activeSince === null) return;
      stopHeartbeat();
      heartbeatTimeout = window.setTimeout(async () => {
        heartbeatTimeout = null;
        const recorded = await heartbeat();
        if (stopped || activeSince === null) return;

        scheduleHeartbeat(
          recorded
            ? HEARTBEAT_MS
            : Math.min(delay * 2, MAX_HEARTBEAT_BACKOFF_MS),
        );
      }, delay);
    };

    const pauseEngagement = () => {
      stopHeartbeat();
      if (activeSince === null) return;
      engagedMilliseconds += Date.now() - activeSince;
      activeSince = null;
    };

    const resumeEngagement = () => {
      if (
        activeSince === null &&
        document.visibilityState === "visible" &&
        document.hasFocus()
      ) {
        activeSince = Date.now();
        scheduleHeartbeat();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        pauseEngagement();
        void heartbeat(true);
      } else {
        resumeEngagement();
      }
    };

    const handleBlur = () => {
      pauseEngagement();
      void heartbeat(true);
    };

    const handleFocus = () => resumeEngagement();

    const handleScroll = () => {
      maxScrollDepth = Math.max(maxScrollDepth, readScrollDepth());
    };

    const handlePageHide = () => {
      pauseEngagement();
      void heartbeat(true);
    };

    const handlePageShow = () => resumeEngagement();

    void postAnalytics({ event: "start", sessionId, ...pageContext });

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleHeartbeat();

    return () => {
      stopped = true;
      stopHeartbeat();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      pauseEngagement();
      void heartbeat(true);
    };
  }, [pathname]);

  return null;
}
