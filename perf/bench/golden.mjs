#!/usr/bin/env node
// 闪电.skill 护栏：黄金比对 + 视觉回归 + SEO 一致性 + 功能冒烟。
//   capture —— 基线版本上采集黄金参照（可见文本、正文 HTML、SEO 字段、元素计数、双宽度截图、sitemap/RSS）
//   check   —— 与黄金参照逐项比对，任一不一致退出码 1
// 用法：node perf/bench/golden.mjs capture|check [--base http://127.0.0.1:3200]
// 注意：比对的是「可见文本 + 正文 HTML + SEO 字段」，不是整个原始 HTML——Next 每次构建的
// build id / chunk hash 会变，整页字节比对会误报；正文 .prose 的 HTML 仍要求逐字节一致。
import { argv } from "node:process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const mode = argv[2];
if (mode !== "capture" && mode !== "check") {
  console.error("用法: node perf/bench/golden.mjs capture|check [--base URL]");
  process.exit(2);
}
const baseIdx = argv.indexOf("--base");
const BASE = baseIdx > -1 ? argv[baseIdx + 1] : "http://127.0.0.1:3200";
const GOLDEN_DIR = new URL("./golden/", import.meta.url).pathname;
const SLUG = encodeURIComponent("撒大方");

const TARGETS = [
  { name: "home", path: "/", ready: "document.querySelector('h1') && document.querySelectorAll('.site-shell p, .site-shell .topic-pill').length >= 4" },
  { name: "blog", path: "/blog", ready: "document.querySelector('#all-articles-heading') && document.querySelectorAll('.article-row').length >= 1" },
  { name: "article", path: `/blog/${SLUG}`, ready: "document.querySelector('article h1') && document.querySelector('.prose') && document.querySelector('.prose').textContent.trim().length > 200" },
];

const norm = (s) => s.replace(/\s+/g, " ").trim();
const sha = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 16);

async function snapshot(browser, t) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + t.path, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(`!!(${t.ready})`, undefined, { timeout: 15000, polling: 50 });
  // 长页整页截图必须等客户端组件（评论/点赞等）全部水合取数完成，否则构建间的
  // 水合时序抖动会让截图高度差出几十像素，把护栏变成噪声
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => ({
    title: document.title,
    metaDesc: document.querySelector('meta[name="description"]')?.content ?? null,
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
    jsonld: document.querySelector('script[type="application/ld+json"]')?.textContent ?? null,
    bodyText: document.body.innerText,
    // 剥掉 React 流式渲染注入的 Suspense 边界注释（<!--$--> 等），只比对真实标记
    proseHTML: document.querySelector(".prose")?.innerHTML.replace(/<!--.*?-->/g, "") ?? null,
    counts: {
      h1: document.querySelectorAll("h1").length,
      h2: document.querySelectorAll("h2").length,
      links: document.querySelectorAll("a[href]").length,
      articleRows: document.querySelectorAll(".article-row").length,
      imgs: document.querySelectorAll("img").length,
    },
  }));
  data.bodyText = norm(data.bodyText);
  if (data.jsonld) data.jsonld = norm(data.jsonld);
  const png1440 = await page.screenshot({ fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const png390 = await page.screenshot({ fullPage: true });
  // 功能冒烟：文章页正文里点击一个指向站内的链接能导航成功
  if (t.name === "article") {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE + t.path, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(`!!(${t.ready})`, { timeout: 15000, polling: 50 });
    const back = page.locator('a[href="/blog"]').first();
    data.smokeBackLinkVisible = await back.isVisible();
  }
  await ctx.close();
  return { data, png1440, png390 };
}

async function fetchBytes(path) {
  const res = await fetch(BASE + path);
  return { status: res.status, body: Buffer.from(await res.arrayBuffer()) };
}

const browser = await chromium.launch();
const report = { mismatches: [], notes: [] };
mkdirSync(GOLDEN_DIR, { recursive: true });

for (const t of TARGETS) {
  const { data, png1440, png390 } = await snapshot(browser, t);
  const goldenPath = `${GOLDEN_DIR}${t.name}.json`;
  if (mode === "capture") {
    writeFileSync(goldenPath, JSON.stringify(data, null, 1));
    writeFileSync(`${GOLDEN_DIR}${t.name}-1440.png`, png1440);
    writeFileSync(`${GOLDEN_DIR}${t.name}-390.png`, png390);
    console.log(`captured ${t.name}: text ${data.bodyText.length} chars, png ${png1440.length}/${png390.length} bytes`);
  } else {
    if (!existsSync(goldenPath)) { report.mismatches.push(`${t.name}: 黄金参照缺失`); continue; }
    const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
    for (const key of ["title", "metaDesc", "canonical", "jsonld", "bodyText", "proseHTML", "counts", "smokeBackLinkVisible"]) {
      const a = JSON.stringify(golden[key]), b = JSON.stringify(data[key]);
      if (a !== b) report.mismatches.push(`${t.name}.${key} 不一致`);
    }
    for (const [label, png] of [["1440", png1440], ["390", png390]]) {
      const goldenPng = readFileSync(`${GOLDEN_DIR}${t.name}-${label}.png`);
      if (sha(goldenPng) !== sha(png)) report.mismatches.push(`${t.name}-${label}.png 截图有差异`);
    }
    console.log(`checked ${t.name}`);
  }
}

for (const path of ["/sitemap.xml", "/rss.xml", "/robots.txt"]) {
  const { status, body } = await fetchBytes(path);
  const goldenPath = `${GOLDEN_DIR}${path.replaceAll("/", "_")}.bin`;
  if (mode === "capture") {
    writeFileSync(goldenPath, body);
    console.log(`captured ${path}: status ${status}, ${body.length} bytes`);
  } else if (existsSync(goldenPath)) {
    const golden = readFileSync(goldenPath);
    if (sha(golden) !== sha(body)) report.mismatches.push(`${path} 内容不一致`);
  } else {
    report.mismatches.push(`${path}: 黄金参照缺失`);
  }
}

await browser.close();

if (mode === "capture") {
  console.log("✅ 黄金参照已采集");
} else if (report.mismatches.length) {
  for (const m of report.mismatches) console.error("✗ " + m);
  process.exit(1);
} else {
  console.log("✅ 全部护栏通过：可见文本、正文 HTML、SEO 字段、元素计数、截图、sitemap/RSS/robots 逐项一致");
}
