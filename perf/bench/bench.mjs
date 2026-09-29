#!/usr/bin/env node
// 闪电.skill 测速（Node 移植版）：冷缓存下测「打开到能用」。
// 与 skill 自带 scripts/bench.py 同口径：同样的限速档常量、每次新浏览器上下文、
// CDP 禁用缓存、判定表达式每帧轮询、settle 后统一收集、type-7 分位数、A/B 交替配对。
// 差异仅一处：playwright 用 Node 版（本机 Python 3.14 无 wheel），浏览器可用
// --executable 指定本机已缓存的 Chromium。
import { argv, stderr } from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "playwright";

// 网络档：延迟单位 ms，吞吐单位 字节/秒（与 bench.py 完全一致）
const PROFILES = {
  none: null,
  fast4g: { offline: false, latency: 20,
    downloadThroughput: 4 * 1024 * 1024 / 8,
    uploadThroughput: 3 * 1024 * 1024 / 8 },
  slow4g: { offline: false, latency: 150,
    downloadThroughput: 1.6 * 1024 * 1024 / 8,
    uploadThroughput: 750 * 1024 / 8 },
};

const INIT_JS = (readyExpr) => `
(() => {
  const READY = () => { try { return !!(eval(${JSON.stringify(readyExpr)})); } catch (e) { return false; } };
  const f = window.__flash = { ready: null, lcp: null, longtask: 0 };
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) f.lcp = e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) f.longtask += e.duration; })
      .observe({ type: 'longtask', buffered: true });
  } catch (e) {}
  const tick = () => {
    if (f.ready === null && READY()) { f.ready = performance.now(); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
`;

// 注意：playwright JS 把字符串当表达式求值（Python 版会调用箭头函数），所以用 IIFE
const COLLECT_JS = `(() => {
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  const res = performance.getEntriesByType('resource');
  const bytes = {};
  for (const r of res) {
    const k = r.initiatorType || 'other';
    bytes[k] = (bytes[k] || 0) + (r.transferSize || 0);
  }
  const slowest = res.slice().sort((a, b) => b.responseEnd - a.responseEnd).slice(0, 5)
    .map(r => ({ name: r.name.slice(0, 120), responseEnd: Math.round(r.responseEnd) }));
  return {
    ready: window.__flash.ready, lcp: window.__flash.lcp, longtask: window.__flash.longtask,
    fcp: fcp ? fcp.startTime : null,
    dcl: nav.domContentLoadedEventEnd || null, load: nav.loadEventEnd || null,
    requests: res.length + 1,
    bytes_total: res.reduce((s, r) => s + (r.transferSize || 0), 0) + (nav.transferSize || 0),
    bytes_by_type: bytes, slowest: slowest,
  };
})()`;

function pct(values, p) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  if (v.length === 1) return Math.round(v[0] * 10) / 10;
  // type-7 分位（Python statistics.quantiles inclusive 的等价实现）
  const pos = (p / 100) * (v.length - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return Math.round((v[lo] + (v[hi] - v[lo]) * (pos - lo)) * 10) / 10;
}

function parseArgs() {
  const spec = {
    url: String, "url-b": String, ready: String, "type-check": String,
    runs: Number, profile: String, cpu: Number, width: Number, height: Number,
    timeout: Number, settle: Number, proxy: String, out: String, executable: String,
  };
  const defaults = {
    ready: "document.readyState !== 'loading' && !!document.body && document.body.innerText.trim().length > 0",
    runs: 10, profile: "fast4g", cpu: 1, width: 1440, height: 900,
    timeout: 30, settle: 500,
  };
  const args = { ...defaults };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new Error(`无法识别的参数: ${a}`);
    const key = a.slice(2).split("=")[0];
    const inline = a.includes("=");
    const raw = inline ? a.slice(2 + key.length + 1) : argv[++i];
    if (!(key in spec)) throw new Error(`未知参数: --${key}`);
    args[key] = spec[key](raw);
  }
  if (!args.url) throw new Error("--url 必填");
  if (!(args.profile in PROFILES)) throw new Error(`未知网络档: ${args.profile}`);
  return args;
}

async function measureOnce(browser, url, args) {
  const ctx = await browser.newContext({ viewport: { width: args.width, height: args.height } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (PROFILES[args.profile]) {
    await cdp.send("Network.emulateNetworkConditions", PROFILES[args.profile]);
  }
  if (args.cpu > 1) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: args.cpu });
  }
  await page.addInitScript(INIT_JS(args.ready));
  const out = { url, ok: true };
  try {
    await page.goto(url, { waitUntil: "commit", timeout: args.timeout * 1000 });
    await page.waitForFunction("window.__flash && window.__flash.ready !== null",
      undefined, { timeout: args.timeout * 1000, polling: 50 });
    if (args["type-check"]) {
      await page.click(args["type-check"]);
      await page.keyboard.type("Z");
      const typed = await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return false;
        const v = "value" in el ? el.value : el.innerText;
        return (v || "").includes("Z");
      }, args["type-check"]);
      out.type_check = !!typed;
      if (!typed) out.ok = false;
    }
    await page.waitForTimeout(args.settle);
    Object.assign(out, await page.evaluate(COLLECT_JS));
  } catch (e) { // 超时或页面出错：如实记录，不计入分位数
    out.ok = false;
    out.error = String(e).slice(0, 300);
  }
  await ctx.close();
  return out;
}

function summarize(runs) {
  const good = runs.filter((r) => r.ok);
  const s = { n: runs.length, n_ok: good.length };
  for (const k of ["ready", "lcp", "fcp", "dcl", "load", "longtask", "requests", "bytes_total"]) {
    s[k] = {
      p50: pct(good.map((r) => r[k]), 50),
      p75: pct(good.map((r) => r[k]), 75),
      p95: pct(good.map((r) => r[k]), 95),
    };
  }
  return s;
}

const args = parseArgs();
const urls = { A: args.url };
if (args["url-b"]) urls.B = args["url-b"];
const runs = { A: [], B: [] };
const started = new Date().toISOString().replace("T", " ").slice(0, 19);

const browser = await chromium.launch({
  ...(args.executable ? { executablePath: args.executable } : {}),
  ...(args.proxy ? { args: [`--proxy-server=${args.proxy}`, "--proxy-bypass-list=127.0.0.1,localhost,<local>"] } : {}),
});
for (let i = 0; i < args.runs; i++) {
  const order = i % 2 === 0 ? ["A", ...(urls.B ? ["B"] : [])] : [...(urls.B ? ["B"] : []), "A"];
  for (const k of order) {
    const r = await measureOnce(browser, urls[k], args);
    runs[k].push(r);
    const flag = r.ok ? "" : `  失败: ${r.error ?? "打字校验没通过"}`;
    stderr.write(`[${i + 1}/${args.runs}] ${k} ready=${r.ready != null ? Math.round(r.ready) : ""}ms lcp=${r.lcp != null ? Math.round(r.lcp) : ""}ms${flag}\n`);
  }
}
await browser.close();

const result = {
  started,
  finished: new Date().toISOString().replace("T", " ").slice(0, 19),
  config: {
    runs: args.runs, profile: args.profile, cpu: args.cpu, width: args.width,
    height: args.height, ready: args.ready, type_check: args["type-check"] ?? null,
  },
  paired: !!args["url-b"],
  results: {},
};
for (const k of Object.keys(urls)) {
  result.results[k] = { url: urls[k], summary: summarize(runs[k]), runs: runs[k] };
}
if (args["url-b"]) {
  const a = result.results.A.summary.ready.p75;
  const b = result.results.B.summary.ready.p75;
  if (a != null && b != null) result.ready_p75_reduction = Math.round((1 - b / a) * 10000) / 10000;
}

for (const [k, v] of Object.entries(result.results)) {
  const s = v.summary;
  console.log(`${k}  ${v.url}  成功 ${s.n_ok}/${s.n}  能用 p50/p75/p95 = ${s.ready.p50}/${s.ready.p75}/${s.ready.p95} ms  LCP p75 = ${s.lcp.p75} ms  请求数 p75 = ${s.requests.p75}  字节 p75 = ${s.bytes_total.p75}`);
}
if (result.ready_p75_reduction != null) {
  console.log(`能用 p75 降幅：${(result.ready_p75_reduction * 100).toFixed(1)}%`);
}
if (args.out) {
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify(result, null, 1));
}
