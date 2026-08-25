import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/blog/memory",
}));

import { AnalyticsTracker } from "@/components/AnalyticsTracker";

const sessionId = "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011";

function analyticsBody(call: unknown[]) {
  return JSON.parse(String((call[1] as RequestInit).body));
}

describe("AnalyticsTracker", () => {
  let visibilityState: DocumentVisibilityState;
  let documentFocused: boolean;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T10:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))),
    );
    vi.spyOn(window.crypto, "randomUUID").mockReturnValue(sessionId);
    Object.defineProperty(document, "title", {
      configurable: true,
      value: "Memory benchmark",
    });
    visibilityState = "visible";
    documentFocused = true;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });
    vi.spyOn(document, "hasFocus").mockImplementation(() => documentFocused);
    Object.defineProperty(navigator, "doNotTrack", {
      configurable: true,
      value: "0",
    });
    Object.defineProperty(navigator, "globalPrivacyControl", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn(() => true),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts a page view and reports a complete heartbeat snapshot", async () => {
    render(<AnalyticsTracker />);

    expect(analyticsBody(vi.mocked(fetch).mock.calls[0])).toEqual({
      event: "start",
      sessionId,
      path: "/blog/memory",
      title: "Memory benchmark",
      referrer: "",
    });

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    expect(analyticsBody(vi.mocked(fetch).mock.calls[1])).toEqual({
      event: "heartbeat",
      sessionId,
      path: "/blog/memory",
      title: "Memory benchmark",
      referrer: "",
      engagedSeconds: 15,
      scrollDepth: 100,
    });
  });

  it("counts only visible time and uses Beacon for hide, pagehide, and cleanup", async () => {
    const { unmount } = render(<AnalyticsTracker />);

    act(() => vi.advanceTimersByTime(5_000));
    visibilityState = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    const beacon = vi.mocked(navigator.sendBeacon);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await (beacon.mock.calls[0][1] as Blob).text())).toEqual(
      expect.objectContaining({ engagedSeconds: 5 }),
    );

    act(() => vi.advanceTimersByTime(30_000));
    visibilityState = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => vi.advanceTimersByTime(5_000));
    act(() => window.dispatchEvent(new Event("pagehide")));

    expect(JSON.parse(await (beacon.mock.calls[1][1] as Blob).text())).toEqual(
      expect.objectContaining({ engagedSeconds: 10 }),
    );

    unmount();
    const callsAfterUnmount = vi.mocked(fetch).mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
      await Promise.resolve();
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(callsAfterUnmount);
  });

  it("does not count time while the browser window is unfocused", async () => {
    render(<AnalyticsTracker />);

    act(() => vi.advanceTimersByTime(5_000));
    documentFocused = false;
    act(() => window.dispatchEvent(new Event("blur")));
    act(() => vi.advanceTimersByTime(30_000));
    documentFocused = true;
    act(() => window.dispatchEvent(new Event("focus")));
    act(() => vi.advanceTimersByTime(5_000));
    act(() => window.dispatchEvent(new Event("pagehide")));

    const beacon = vi.mocked(navigator.sendBeacon);
    const finalSnapshot = JSON.parse(
      await (beacon.mock.calls.at(-1)?.[1] as Blob).text(),
    );
    expect(finalSnapshot).toEqual(
      expect.objectContaining({ engagedSeconds: 10 }),
    );
  });

  it("starts counting only after an initially unfocused window gains focus", async () => {
    documentFocused = false;
    render(<AnalyticsTracker />);

    act(() => vi.advanceTimersByTime(30_000));
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    documentFocused = true;
    act(() => window.dispatchEvent(new Event("focus")));
    act(() => vi.advanceTimersByTime(5_000));
    act(() => window.dispatchEvent(new Event("pagehide")));

    const beacon = vi.mocked(navigator.sendBeacon);
    const finalSnapshot = JSON.parse(
      await (beacon.mock.calls.at(-1)?.[1] as Blob).text(),
    );
    expect(finalSnapshot).toEqual(
      expect.objectContaining({ engagedSeconds: 5 }),
    );
  });

  it("pauses periodic heartbeats while inactive and resumes after focus", async () => {
    render(<AnalyticsTracker />);

    act(() => vi.advanceTimersByTime(5_000));
    documentFocused = false;
    act(() => window.dispatchEvent(new Event("blur")));

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    documentFocused = true;
    act(() => window.dispatchEvent(new Event("focus")));
    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(analyticsBody(vi.mocked(fetch).mock.calls[1])).toEqual(
      expect.objectContaining({ engagedSeconds: 20 }),
    );
  });

  it("resumes engagement when a page returns from the back-forward cache", async () => {
    render(<AnalyticsTracker />);

    act(() => vi.advanceTimersByTime(5_000));
    act(() => window.dispatchEvent(new PageTransitionEvent("pagehide", {
      persisted: true,
    })));
    act(() => vi.advanceTimersByTime(30_000));
    act(() => window.dispatchEvent(new PageTransitionEvent("pageshow", {
      persisted: true,
    })));
    act(() => vi.advanceTimersByTime(5_000));
    act(() => window.dispatchEvent(new Event("pagehide")));

    const beacon = vi.mocked(navigator.sendBeacon);
    const finalSnapshot = JSON.parse(
      await (beacon.mock.calls.at(-1)?.[1] as Blob).text(),
    );
    expect(finalSnapshot).toEqual(
      expect.objectContaining({ engagedSeconds: 10 }),
    );
  });

  it("falls back to fetch when Beacon cannot queue the final snapshot", () => {
    vi.mocked(navigator.sendBeacon).mockReturnValue(false);
    render(<AnalyticsTracker />);

    act(() => window.dispatchEvent(new Event("pagehide")));

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(analyticsBody(vi.mocked(fetch).mock.calls[1])).toEqual(
      expect.objectContaining({ event: "heartbeat", sessionId }),
    );
  });

  it("backs off periodic heartbeats after server failures", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));
    render(<AnalyticsTracker />);

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["Do Not Track", { doNotTrack: "1", globalPrivacyControl: false }],
    ["Global Privacy Control", { doNotTrack: "0", globalPrivacyControl: true }],
  ])("does not collect when %s opts out", (_label, privacy) => {
    Object.defineProperty(navigator, "doNotTrack", {
      configurable: true,
      value: privacy.doNotTrack,
    });
    Object.defineProperty(navigator, "globalPrivacyControl", {
      configurable: true,
      value: privacy.globalPrivacyControl,
    });

    render(<AnalyticsTracker />);

    expect(fetch).not.toHaveBeenCalled();
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });
});
