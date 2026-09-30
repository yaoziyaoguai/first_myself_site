#!/usr/bin/env node
/**
 * perf-v2 浏览器测量协议。
 *
 * 首屏资源测量与点击/输入功能验证使用不同 browser context，避免测试动作污染
 * 请求数和传输字节。任一必测样本不完整时仍保存原始 JSON，但进程以非零退出。
 */
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { platform, release, arch } from "node:os";
import { spawnSync } from "node:child_process";
import { argv, cwd, stderr } from "node:process";
import { performance as nodePerformance } from "node:perf_hooks";
import { chromium } from "playwright";

const PROTOCOL_VERSION = "perf-v2";
const IDLE_WINDOW_MS = 1_000;
const PERSISTENT_TYPES = new Set(["WebSocket", "EventSource"]);
const METRICS = [
  "ttfb_ms",
  "usable_ms",
  "full_load_ms",
  "requests_started",
  "requests_completed",
  "requests_failed",
  "requests_inflight",
  "encoded_bytes",
];
const PROFILES = {
  none: null,
  fast4g: {
    offline: false,
    latency: 20,
    downloadThroughput: 4 * 1024 * 1024 / 8,
    uploadThroughput: 3 * 1024 * 1024 / 8,
  },
  slow4g: {
    offline: false,
    latency: 150,
    downloadThroughput: 1.6 * 1024 * 1024 / 8,
    uploadThroughput: 750 * 1024 / 8,
  },
};

const require = createRequire(import.meta.url);
const PLAYWRIGHT_VERSION = require("playwright/package.json").version;
const THIS_FILE = fileURLToPath(import.meta.url);

const INIT_JS = (readyExpression) => `
(() => {
  const ready = () => {
    try { return Boolean(eval(${JSON.stringify(readyExpression)})); }
    catch { return false; }
  };
  const state = window.__perfV2 = { usable: null };
  const tick = () => {
    if (state.usable === null && ready()) state.usable = performance.now();
    if (state.usable === null) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
`;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function percentile(values, p) {
  if (!Number.isFinite(p) || p < 0 || p > 100) return null;
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (!sorted.length) return null;
  if (sorted.length === 1) return Math.round(sorted[0] * 10) / 10;
  const position = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return Math.round(
    (sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)) * 10,
  ) / 10;
}

function metricSummary(values) {
  return {
    p50: percentile(values, 50),
    p75: percentile(values, 75),
    p95: percentile(values, 95),
  };
}

export function summarizeRuns(runs) {
  const completeRuns = runs.filter((run) => run.complete === true);
  const acceptanceValid = runs.length > 0 && completeRuns.length === runs.length;
  const summary = {
    n: runs.length,
    n_ok: completeRuns.length,
    complete: completeRuns.length,
    acceptance_valid: acceptanceValid,
  };
  for (const metric of METRICS) {
    summary[metric] = acceptanceValid
      ? metricSummary(completeRuns.map((run) => run[metric]))
      : { p50: null, p75: null, p95: null };
  }
  return summary;
}

export function functionalNavigationMatches(href, before, target) {
  return href !== before && (!target || href.includes(target));
}

export function hasNetworkIdleWindow(snapshot, now, idleMs = IDLE_WINDOW_MS) {
  return snapshot.requests_inflight === 0 &&
    Number.isFinite(snapshot.last_activity_ms) &&
    now - snapshot.last_activity_ms >= idleMs;
}

function isFullGitSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
}

export function createNetworkLedger(now = () => nodePerformance.now()) {
  const records = [];
  const active = new Map();
  const excluded = [];
  let lastActivity = now();

  function finish(record, outcome, details = {}) {
    if (!record || record.outcome) return;
    record.outcome = outcome;
    record.finished_at_ms = now();
    Object.assign(record, details);
    active.delete(record.request_id);
    lastActivity = now();
  }

  return {
    requestWillBeSent(event) {
      lastActivity = now();
      if (PERSISTENT_TYPES.has(event.type)) {
        excluded.push({
          request_id: event.requestId,
          type: event.type,
          url: event.request?.url ?? null,
        });
        return;
      }
      const previous = active.get(event.requestId);
      if (previous && event.redirectResponse) {
        const redirectBytes = event.redirectResponse.encodedDataLength;
        finish(previous, "completed", {
          encoded_bytes: Number.isFinite(redirectBytes) ? redirectBytes : null,
          status: event.redirectResponse.status ?? previous.status ?? null,
          redirected: true,
        });
      }
      const record = {
        request_id: event.requestId,
        sequence: records.length + 1,
        type: event.type ?? "Other",
        url: event.request?.url ?? null,
        started_at_ms: now(),
        status: null,
        encoded_bytes: null,
        outcome: null,
      };
      records.push(record);
      active.set(event.requestId, record);
    },
    responseReceived(event) {
      lastActivity = now();
      const record = active.get(event.requestId);
      if (!record) return;
      record.status = event.response?.status ?? null;
      record.final_url = event.response?.url ?? record.url;
    },
    loadingFinished(event) {
      const record = active.get(event.requestId);
      finish(record, "completed", {
        encoded_bytes: Number.isFinite(event.encodedDataLength)
          ? event.encodedDataLength
          : null,
      });
    },
    loadingFailed(event) {
      const record = active.get(event.requestId);
      finish(record, "failed", {
        error_text: event.errorText ?? "request failed",
        canceled: Boolean(event.canceled),
      });
    },
    snapshot() {
      const completed = records.filter((record) => record.outcome === "completed");
      const failed = records.filter((record) => record.outcome === "failed");
      const inflight = records.filter((record) => record.outcome === null);
      const unknownBytes = completed.filter(
        (record) => !Number.isFinite(record.encoded_bytes),
      ).length;
      return {
        requests_started: records.length,
        requests_completed: completed.length,
        requests_failed: failed.length,
        requests_inflight: inflight.length,
        encoded_bytes: unknownBytes === 0
          ? completed.reduce((total, record) => total + record.encoded_bytes, 0)
          : null,
        encoded_bytes_unknown: unknownBytes,
        http_errors: records
          .filter((record) => Number.isFinite(record.status) && record.status >= 400)
          .map((record) => ({ status: record.status, url: record.final_url ?? record.url })),
        excluded_persistent_requests: [...excluded],
        records: records.map((record) => ({ ...record })),
        last_activity_ms: lastActivity,
      };
    },
  };
}

export function evaluateRunCompleteness(run) {
  const positiveMetrics = ["ttfb_ms", "usable_ms", "full_load_ms"];
  const hasPositiveMetrics = positiveMetrics.every(
    (metric) => Number.isFinite(run[metric]) && run[metric] > 0,
  );
  const ledgerBalances =
    Number.isInteger(run.requests_started) &&
    run.requests_started > 0 &&
    run.requests_started ===
      run.requests_completed + run.requests_failed + run.requests_inflight;
  return Boolean(
    hasPositiveMetrics &&
    Number.isFinite(run.encoded_bytes) &&
    run.encoded_bytes > 0 &&
    run.encoded_bytes_unknown === 0 &&
    ledgerBalances &&
    run.requests_failed === 0 &&
    run.requests_inflight === 0 &&
    run.navigation_status >= 200 &&
    run.navigation_status < 400 &&
    run.load_complete === true &&
    run.fonts_complete === true &&
    run.viewport_images_complete === true &&
    run.network_idle_complete === true &&
    run.timed_out !== true &&
    (run.page_errors?.length ?? 0) === 0 &&
    (run.http_errors?.length ?? 0) === 0
  );
}

function remainingMs(deadline) {
  return Math.max(1, deadline - Date.now());
}

async function waitForFontsAndViewportImages(page, deadline) {
  return page.evaluate(async (timeoutMs) => {
    const delay = new Promise((resolve) => {
      setTimeout(() => resolve({ timeout: true }), timeoutMs);
    });
    const work = (async () => {
      let fontsComplete = true;
      try {
        await document.fonts.ready;
      } catch {
        fontsComplete = false;
      }
      const images = [...document.images].filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.bottom > 0 && rect.right > 0 &&
          rect.top < window.innerHeight && rect.left < window.innerWidth;
      });
      const failures = [];
      await Promise.all(images.map((image) => new Promise((resolveImage) => {
        const finish = () => {
          if (!image.naturalWidth) failures.push(image.currentSrc || image.src || "unknown");
          resolveImage();
        };
        if (image.complete) return finish();
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
      })));
      return {
        timeout: false,
        fonts_complete: fontsComplete,
        viewport_images_complete: failures.length === 0,
        viewport_image_failures: failures,
      };
    })();
    return Promise.race([work, delay]);
  }, remainingMs(deadline));
}

async function waitForNetworkIdle(page, ledger, deadline) {
  while (Date.now() < deadline) {
    const snapshot = ledger.snapshot();
    if (hasNetworkIdleWindow(snapshot, nodePerformance.now())) return true;
    await page.waitForTimeout(Math.min(50, remainingMs(deadline)));
  }
  return false;
}

export async function measureOnce(browser, url, args) {
  const context = await browser.newContext({
    viewport: { width: args.width, height: args.height },
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const ledger = createNetworkLedger();
  const deadline = Date.now() + args.timeout * 1_000;
  const pageErrors = [];
  const run = {
    url,
    final_url: null,
    complete: false,
    timed_out: false,
    page_errors: pageErrors,
    navigation_status: null,
    load_complete: false,
    fonts_complete: false,
    viewport_images_complete: false,
    viewport_image_failures: [],
    network_idle_complete: false,
    ttfb_ms: null,
    usable_ms: null,
    full_load_ms: null,
  };

  cdp.on("Network.requestWillBeSent", (event) => ledger.requestWillBeSent(event));
  cdp.on("Network.responseReceived", (event) => ledger.responseReceived(event));
  cdp.on("Network.loadingFinished", (event) => ledger.loadingFinished(event));
  cdp.on("Network.loadingFailed", (event) => ledger.loadingFailed(event));
  page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 500)));

  try {
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (PROFILES[args.profile]) {
      await cdp.send("Network.emulateNetworkConditions", PROFILES[args.profile]);
    }
    if (args.cpu > 1) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: args.cpu });
    }
    await page.addInitScript(INIT_JS(args.ready));
    const response = await page.goto(url, {
      waitUntil: "commit",
      timeout: remainingMs(deadline),
    });
    run.navigation_status = response?.status() ?? null;
    run.final_url = page.url();
    await page.waitForFunction(
      "window.__perfV2 && window.__perfV2.usable !== null",
      undefined,
      { timeout: remainingMs(deadline), polling: 50 },
    );
    run.usable_ms = await page.evaluate(() => window.__perfV2.usable);
    await page.waitForLoadState("load", { timeout: remainingMs(deadline) });
    run.load_complete = true;
    const assets = await waitForFontsAndViewportImages(page, deadline);
    if (assets.timeout) throw new Error("fonts/images readiness timed out");
    Object.assign(run, assets);
    run.network_idle_complete = await waitForNetworkIdle(page, ledger, deadline);
    if (!run.network_idle_complete) throw new Error("network idle timed out");
    const navigation = await page.evaluate(() => {
      const entry = performance.getEntriesByType("navigation")[0];
      return entry ? {
        ttfb: entry.responseStart - entry.startTime,
        load: entry.loadEventEnd > 0 ? entry.loadEventEnd : null,
        now: performance.now(),
      } : null;
    });
    run.ttfb_ms = navigation?.ttfb ?? null;
    run.load_ms = navigation?.load ?? null;
    run.full_load_ms = navigation?.now ?? null;
  } catch (error) {
    run.timed_out = Date.now() >= deadline || /timed out|timeout/i.test(String(error));
    run.error = String(error).slice(0, 500);
  } finally {
    const snapshot = ledger.snapshot();
    Object.assign(run, snapshot);
    run.final_url ??= page.url();
    run.complete = evaluateRunCompleteness(run);
    await context.close();
  }
  return run;
}

async function runFunctionalPass(browser, url, args) {
  if (!args["type-check"] && !args["click-check"]) {
    return { ok: true, skipped: true };
  }
  const context = await browser.newContext({
    viewport: { width: args.width, height: args.height },
  });
  const page = await context.newPage();
  const result = { ok: false, skipped: false, checks: [] };
  try {
    const response = await page.goto(url, {
      waitUntil: "load",
      timeout: args.timeout * 1_000,
    });
    if (!response || response.status() >= 400) {
      throw new Error(`functional navigation status ${response?.status() ?? "unknown"}`);
    }
    if (args["type-check"]) {
      const selector = args["type-check"];
      await page.locator(selector).click();
      await page.locator(selector).fill("perf-v2-input-check");
      const value = await page.locator(selector).inputValue();
      if (value !== "perf-v2-input-check") throw new Error("type check failed");
      result.checks.push({ type: "input", selector, ok: true });
    }
    if (args["click-check"]) {
      const selector = args["click-check"];
      const before = page.url();
      const target = args["click-target"];
      await Promise.all([
        page.waitForURL(
          (urlValue) => functionalNavigationMatches(urlValue.href, before, target),
          { timeout: args.timeout * 1_000 },
        ),
        page.locator(selector).click(),
      ]);
      result.checks.push({
        type: "navigation",
        selector,
        final_url: page.url(),
        ok: true,
      });
    }
    result.ok = true;
  } catch (error) {
    result.error = String(error).slice(0, 500);
  } finally {
    await context.close();
  }
  return result;
}

export function parseArgs(input = argv.slice(2)) {
  const converters = {
    url: String,
    "url-b": String,
    ready: String,
    "type-check": String,
    "click-check": String,
    "click-target": String,
    runs: Number,
    profile: String,
    cpu: Number,
    width: Number,
    height: Number,
    timeout: Number,
    proxy: String,
    out: String,
    executable: String,
    fixture: String,
    "fixture-hash": String,
    "app-sha-a": String,
    "app-sha-b": String,
  };
  const parsed = {
    runs: 10,
    profile: "fast4g",
    cpu: 1,
    width: 1440,
    height: 900,
    timeout: 30,
  };
  for (let index = 0; index < input.length; index += 1) {
    const argument = input[index];
    if (!argument.startsWith("--")) throw new Error(`无法识别的参数: ${argument}`);
    const key = argument.slice(2).split("=")[0];
    if (!(key in converters)) throw new Error(`未知参数: --${key}`);
    const inline = argument.includes("=");
    const raw = inline
      ? argument.slice(2 + key.length + 1)
      : input[++index];
    if (raw === undefined) throw new Error(`--${key} 缺少值`);
    parsed[key] = converters[key](raw);
  }
  for (const required of ["url", "ready", "out", "fixture", "fixture-hash"]) {
    if (!parsed[required]) throw new Error(`--${required} 必填`);
  }
  if (!(parsed.profile in PROFILES)) throw new Error(`未知网络档: ${parsed.profile}`);
  if (!Number.isInteger(parsed.runs) || parsed.runs < 1) throw new Error("--runs 必须为正整数");
  if (!Number.isFinite(parsed.timeout) || parsed.timeout <= 0 || parsed.timeout > 30) {
    throw new Error("--timeout 必须在 0 到 30 秒之间");
  }
  if (parsed["url-b"] && (!parsed["app-sha-a"] || !parsed["app-sha-b"])) {
    throw new Error("配对测量必须提供 --app-sha-a 与 --app-sha-b");
  }
  for (const key of ["app-sha-a", "app-sha-b"]) {
    if (parsed[key] && !isFullGitSha(parsed[key])) {
      throw new Error(`--${key} 必须是完整的 40 位 Git SHA`);
    }
  }
  return parsed;
}

function currentGitSha() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) return "unknown";
  return result.stdout.trim();
}

function environmentMetadata(args, browserVersion) {
  const value = {
    node: process.version,
    playwright: PLAYWRIGHT_VERSION,
    chromium: browserVersion,
    os: `${platform()}-${release()}-${arch()}`,
    viewport: { width: args.width, height: args.height },
    profile: args.profile,
    cpu: args.cpu,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timeout_seconds: args.timeout,
    network_idle_ms: IDLE_WINDOW_MS,
    browser_http_cache: "disabled",
    ready_expression: args.ready,
  };
  return { ...value, environment_id: sha256(JSON.stringify(value)) };
}

async function main() {
  const args = parseArgs();
  const urls = { A: args.url };
  if (args["url-b"]) urls.B = args["url-b"];
  const runs = { A: [], B: [] };
  const toolSha = sha256(readFileSync(THIS_FILE));
  const browser = await chromium.launch({
    ...(args.executable ? { executablePath: args.executable } : {}),
    ...(args.proxy ? {
      args: [
        `--proxy-server=${args.proxy}`,
        "--proxy-bypass-list=127.0.0.1,localhost,<local>",
      ],
    } : {}),
  });
  const environment = environmentMetadata(args, browser.version());
  const started = new Date().toISOString();
  const functional = {};

  try {
    for (let index = 0; index < args.runs; index += 1) {
      const order = index % 2 === 0
        ? ["A", ...(urls.B ? ["B"] : [])]
        : [...(urls.B ? ["B"] : []), "A"];
      for (const version of order) {
        const run = await measureOnce(browser, urls[version], args);
        runs[version].push(run);
        stderr.write(
          `[${index + 1}/${args.runs}] ${version} ` +
          `complete=${run.complete} ttfb=${Math.round(run.ttfb_ms ?? 0)}ms ` +
          `usable=${Math.round(run.usable_ms ?? 0)}ms ` +
          `full=${Math.round(run.full_load_ms ?? 0)}ms` +
          `${run.error ? ` error=${run.error}` : ""}\n`,
        );
      }
    }
    for (const version of Object.keys(urls)) {
      functional[version] = await runFunctionalPass(browser, urls[version], args);
    }
  } finally {
    await browser.close();
  }

  const fallbackSha = currentGitSha();
  const result = {
    protocol_version: PROTOCOL_VERSION,
    started,
    finished: new Date().toISOString(),
    tool_sha: toolSha,
    fixture: {
      id: args.fixture,
      hash: args["fixture-hash"],
    },
    environment,
    config: {
      runs: args.runs,
      ready: args.ready,
      resource_pass: "no interactions",
      functional_pass: {
        type_check: args["type-check"] ?? null,
        click_check: args["click-check"] ?? null,
        click_target: args["click-target"] ?? null,
      },
    },
    paired: Boolean(args["url-b"]),
    results: {},
  };
  for (const version of Object.keys(urls)) {
    result.results[version] = {
      url: urls[version],
      app_sha: args[`app-sha-${version.toLowerCase()}`] ?? fallbackSha,
      functional: functional[version],
      summary: summarizeRuns(runs[version]),
      runs: runs[version],
    };
  }

  mkdirSync(dirname(resolve(args.out)), { recursive: true });
  writeFileSync(resolve(args.out), `${JSON.stringify(result, null, 2)}\n`);

  let failed = false;
  for (const [version, versionResult] of Object.entries(result.results)) {
    const summary = versionResult.summary;
    const functionalOk = versionResult.functional.ok;
    console.log(
      `${version} ${versionResult.url} 完整 ${summary.complete}/${summary.n} ` +
      `TTFB p75=${summary.ttfb_ms.p75}ms ` +
      `能用 p75=${summary.usable_ms.p75}ms ` +
      `完整首屏 p75=${summary.full_load_ms.p75}ms ` +
      `请求 p75=${summary.requests_started.p75} ` +
      `编码字节 p75=${summary.encoded_bytes.p75}`,
    );
    if (!summary.acceptance_valid || !functionalOk) failed = true;
  }
  if (failed) process.exitCode = 1;
}

const invokedPath = argv[1] ? resolve(argv[1]) : "";
if (invokedPath === resolve(THIS_FILE)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
