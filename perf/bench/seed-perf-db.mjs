// 灌性能测试库（first_myself_site_perf）：从 .local/perf-seed/ 读真实长文正文，
// 另造几篇不同长度的代表性文章，直接经 pg 写入 blog 表（绕开 payload 初始化，
// 沙箱内 tsx/payload CLI 不可用）。幂等：库里已有文章则跳过。用法：
//   DATABASE_URL=<perf 库连接串> node perf/bench/seed-perf-db.mjs
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const seedDir = resolve(process.cwd(), ".local/perf-seed");

// 一段可重复拼装的代表性 Markdown：标题、段落、代码块、表格、列表、引用
function block(i) {
  return `
## 第 ${i} 节：数据管道的取舍

在做评测系统时，最常被低估的不是模型能力，而是数据管道的确定性。同一批样本、同一套打分器，
跑两次结果不一样，评测就失去了意义。

\`\`\`typescript
export async function evaluate(sample: Sample): Promise<Score> {
  const response = await model.complete({
    prompt: renderTemplate(sample),
    temperature: 0,
  });
  return scorer.grade(sample, response);
}
\`\`\`

### 小结

- 确定性优先于吞吐
- 失败样本要单独归档
- 打分器变更必须走版本对照

> 评测系统的价值不在跑分本身，而在于它让每一次改动都变得可辩护。

| 维度 | 方案 A | 方案 B |
| --- | --- | --- |
| 成本 | 低 | 中 |
| 延迟 | 高 | 低 |
| 可回放 | 是 | 否 |
`;
}

function makeBody(targetChars) {
  let body = "# 开篇\n\n这是一篇用于性能基线的测试文章，内容结构与真实技术长文一致。\n";
  let i = 1;
  while (body.length < targetChars) {
    body += block(i);
    i += 1;
  }
  return body;
}

const generated = [
  ["perf 基线：短文样本（约 1.5k 字符）", "perf-test-short", "用于博客列表与首页的短文样本。", 1500, "2026-09-28 10:00:00+08", "2 min"],
  ["perf 基线：中篇样本（约 3k 字符）", "perf-test-medium", "中等篇幅、含多个代码块与表格的技术文章样本。", 3000, "2026-09-20 10:00:00+08", "5 min"],
  ["perf 基线：长文样本（约 6k 字符）", "perf-test-long", "长篇幅技术文章样本，用于观察正文渲染成本随长度的变化。", 6000, "2026-09-10 10:00:00+08", "9 min"],
  ["perf 基线：超长文样本（约 12k 字符）", "perf-test-xlong", "与主力样本同量级的超长文，用于配对测的可复现对照。", 12000, "2026-08-30 10:00:00+08", "18 min"],
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query("select count(*)::int as n from blog");
if (rows[0].n > 0) {
  console.log(`库中已有 ${rows[0].n} 篇文章，跳过灌数据（幂等保护）。`);
  await client.end();
  process.exit(0);
}

// 主力样本：真实长文正文（12690 字符、41 个标题、25 个代码块）
const meta = JSON.parse(readFileSync(resolve(seedDir, "sadafang.json"), "utf8"));
const realBody = readFileSync(resolve(seedDir, "sadafang.md"), "utf8");

const posts = [
  [meta.title ? `perf 基线主力样本：${meta.title}（真实长文正文）` : "perf 基线主力样本（真实长文正文）",
   meta.slug, meta.excerpt || "性能基线主力样本。", realBody, "2026-03-30 20:00:00+08", "20 min"],
  ...generated.map(([title, slug, excerpt, len, date, rt]) => [title, slug, excerpt, makeBody(len), date, rt]),
];

for (const [title, slug, excerpt, markdown, date, readingTime] of posts) {
  await client.query(
    `insert into blog (title, slug, excerpt, content_markdown, published_date, reading_time, status, visibility)
     values ($1, $2, $3, $4, $5, $6, 'published', 'public')`,
    [title, slug, excerpt, markdown, date, readingTime],
  );
  console.log(`created: ${slug} (${markdown.length} chars)`);
}
console.log(`✅ 共 ${posts.length} 篇（清理：delete from blog where slug like 'perf-test-%' or slug = '${meta.slug}'）`);
await client.end();
