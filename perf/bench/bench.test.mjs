import assert from "node:assert/strict";
import test from "node:test";
import {
  createNetworkLedger,
  evaluateRunCompleteness,
  parseArgs,
  percentile,
  summarizeRuns,
} from "./bench.mjs";

function validRun(overrides = {}) {
  return {
    complete: true,
    navigation_status: 200,
    ttfb_ms: 120,
    usable_ms: 240,
    full_load_ms: 480,
    requests_started: 3,
    requests_completed: 3,
    requests_failed: 0,
    requests_inflight: 0,
    encoded_bytes: 12_000,
    encoded_bytes_unknown: 0,
    load_complete: true,
    fonts_complete: true,
    viewport_images_complete: true,
    network_idle_complete: true,
    timed_out: false,
    page_errors: [],
    http_errors: [],
    ...overrides,
  };
}

test("uses type-7 percentiles and rejects non-finite values", () => {
  assert.equal(percentile([100, 200, 300, 400], 75), 325);
  assert.equal(percentile([Number.NaN, Number.POSITIVE_INFINITY], 75), null);
});

test("keeps delayed resources in the ledger until they finish", () => {
  let now = 10;
  const ledger = createNetworkLedger(() => now);
  ledger.requestWillBeSent({
    requestId: "1",
    type: "Image",
    request: { url: "https://example.test/slow.png" },
  });
  assert.equal(ledger.snapshot().requests_inflight, 1);
  now = 500;
  ledger.responseReceived({
    requestId: "1",
    response: { status: 200, url: "https://example.test/slow.png" },
  });
  ledger.loadingFinished({ requestId: "1", encodedDataLength: 1024 });
  const snapshot = ledger.snapshot();
  assert.equal(snapshot.requests_started, 1);
  assert.equal(snapshot.requests_completed, 1);
  assert.equal(snapshot.requests_failed, 0);
  assert.equal(snapshot.requests_inflight, 0);
  assert.equal(snapshot.encoded_bytes, 1024);
});

test("excludes only persistent connection types", () => {
  const ledger = createNetworkLedger();
  ledger.requestWillBeSent({
    requestId: "ws",
    type: "WebSocket",
    request: { url: "wss://example.test/socket" },
  });
  const snapshot = ledger.snapshot();
  assert.equal(snapshot.requests_started, 0);
  assert.equal(snapshot.excluded_persistent_requests.length, 1);
});

test("does not accept 404 pages merely because they render body text", () => {
  const run = validRun({ navigation_status: 404 });
  assert.equal(evaluateRunCompleteness(run), false);
});

test("does not accept a missing business sentinel, load, or timed-out run", () => {
  assert.equal(evaluateRunCompleteness(validRun({ usable_ms: null })), false);
  assert.equal(evaluateRunCompleteness(validRun({ load_complete: false })), false);
  assert.equal(evaluateRunCompleteness(validRun({ timed_out: true })), false);
});

test("does not accept failed, unknown-size, or still in-flight resources", () => {
  assert.equal(evaluateRunCompleteness(validRun({
    requests_completed: 2,
    requests_failed: 1,
  })), false);
  assert.equal(evaluateRunCompleteness(validRun({
    encoded_bytes: null,
    encoded_bytes_unknown: 1,
  })), false);
  assert.equal(evaluateRunCompleteness(validRun({
    requests_completed: 2,
    requests_inflight: 1,
  })), false);
});

test("does not accept zero or illegal timing values", () => {
  assert.equal(evaluateRunCompleteness(validRun({ ttfb_ms: 0 })), false);
  assert.equal(evaluateRunCompleteness(validRun({ usable_ms: Number.NaN })), false);
  assert.equal(
    evaluateRunCompleteness(validRun({ full_load_ms: Number.POSITIVE_INFINITY })),
    false,
  );
});

test("refuses to calculate acceptance percentiles for a partial batch", () => {
  const failed = validRun({ complete: false, timed_out: true });
  const summary = summarizeRuns([validRun(), failed]);
  assert.equal(summary.n, 2);
  assert.equal(summary.n_ok, 1);
  assert.equal(summary.complete, 1);
  assert.equal(summary.acceptance_valid, false);
  assert.equal(summary.usable_ms.p75, null);
});

test("requires explicit fixture, sentinel, output, and paired SHAs", () => {
  assert.throws(() => parseArgs(["--url", "http://localhost:3000"]), /--ready 必填/);
  assert.throws(() => parseArgs([
    "--url", "http://localhost:3000",
    "--url-b", "http://localhost:3001",
    "--ready", "document.body",
    "--out", "result.json",
    "--fixture", "seed-v1",
    "--fixture-hash", "abc",
  ]), /--app-sha-a/);
});
