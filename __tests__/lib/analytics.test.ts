import { describe, expect, it } from "vitest";
import { parseAnalyticsEvent } from "@/lib/analytics";

describe("parseAnalyticsEvent", () => {
  it("accepts a page-view start and keeps only privacy-safe navigation data", () => {
    expect(
      parseAnalyticsEvent({
        event: "start",
        sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
        path: "/blog/memory?draftToken=secret",
        title: "  Memory benchmark  ",
        referrer: "https://www.google.com/search?q=private-query",
      }),
    ).toEqual({
      event: "start",
      sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
      path: "/blog/memory",
      title: "Memory benchmark",
      referrerHost: "www.google.com",
    });
  });

  it("clamps heartbeat duration and scroll depth to safe ranges", () => {
    expect(
      parseAnalyticsEvent({
        event: "heartbeat",
        sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
        path: "/blog/memory?draftToken=secret",
        title: "Memory benchmark",
        referrer: "https://www.google.com/search?q=private-query",
        engagedSeconds: 100_000,
        scrollDepth: 140,
      }),
    ).toEqual({
      event: "heartbeat",
      sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
      path: "/blog/memory",
      title: "Memory benchmark",
      referrerHost: "www.google.com",
      engagedSeconds: 86_400,
      scrollDepth: 100,
    });
  });

  it("rejects malformed identity, external paths, and invalid metrics", () => {
    expect(
      parseAnalyticsEvent({
        event: "start",
        sessionId: "not-a-uuid",
        path: "/",
      }),
    ).toBeNull();
    expect(
      parseAnalyticsEvent({
        event: "start",
        sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
        path: "https://attacker.example/forged",
      }),
    ).toBeNull();
    expect(
      parseAnalyticsEvent({
        event: "heartbeat",
        sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
        path: "/",
        engagedSeconds: Number.POSITIVE_INFINITY,
        scrollDepth: 10,
      }),
    ).toBeNull();
  });
});
