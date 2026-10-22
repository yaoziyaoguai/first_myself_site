import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  canonicalFence,
  canonicalizeMarker,
  extractInteractiveMarkers,
  isSafeLocalHtmlPath,
  parseMarkerJson,
  projectInteractiveHtmlForAgent,
  validateMarkerSyntax,
} from "@/lib/interactive-html/marker";

const SHA = "a".repeat(64);

function fence(json: string, lang = "interactive-html"): string {
  return ["```" + lang, json, "```"].join("\n");
}

function markerJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    id: "demo",
    sha256: SHA,
    caption: "排队延迟",
    summary: "拖动滑块观察等待时间",
    ...overrides,
  });
}

describe("interactive marker 协议", () => {
  it("接受规范 marker 并保留源偏移", () => {
    const markdown = `前言\n\n${fence(markerJson())}\n\n结尾`;
    const { markers, errors } = extractInteractiveMarkers(markdown);
    expect(errors).toEqual([]);
    expect(markers).toHaveLength(1);
    expect(markers[0].marker).toMatchObject({ id: "demo", sha256: SHA });
    expect(markdown.slice(markers[0].start, markers[0].end)).toContain(
      "```interactive-html",
    );
  });

  it("拒绝重复 id、未知字段、非法 id 与缺失 caption", () => {
    expect(
      validateMarkerSyntax(`${fence(markerJson())}\n\n${fence(markerJson())}`),
    ).toEqual([expect.stringContaining("id 重复")]);
    expect(validateMarkerSyntax(fence(markerJson({ extra: 1 })))).toEqual([
      expect.stringContaining("未知字段"),
    ]);
    expect(validateMarkerSyntax(fence(markerJson({ id: "Bad_ID" })))).toEqual([
      expect.stringContaining("[a-z][a-z0-9-]{0,47}"),
    ]);
    expect(
      validateMarkerSyntax(
        fence(JSON.stringify({ version: 1, id: "x", sha256: SHA })),
      ),
    ).toEqual([expect.stringContaining("caption")]);
  });

  it("path 与 sha256 必须恰有一个，已保存正文不接受本机路径", () => {
    const withBoth = markerJson({ path: "assets/demo.html" });
    expect(validateMarkerSyntax(fence(withBoth))).toEqual([
      expect.stringContaining("恰有一个"),
    ]);
    const pathOnly = JSON.stringify({
      version: 1,
      id: "demo",
      path: "assets/demo.html",
      caption: "x",
    });
    expect(validateMarkerSyntax(fence(pathOnly))).toEqual([
      expect.stringContaining("不能保存本机路径"),
    ]);
    const parsed = parseMarkerJson(pathOnly, { allowLocalPath: true });
    expect(parsed.ok && parsed.marker.path).toBe("assets/demo.html");
  });

  it("拒绝重复键与尾随内容（严格 JSON）", () => {
    const duplicate = `{"version":1,"id":"demo","sha256":"${SHA}","caption":"a","caption":"b"}`;
    expect(parseMarkerJson(duplicate, { allowLocalPath: false }).ok).toBe(
      false,
    );
    const trailing = `{"version":1,"id":"demo","sha256":"${SHA}","caption":"a"} x`;
    expect(parseMarkerJson(trailing, { allowLocalPath: false }).ok).toBe(false);
  });

  it("只把顶层 fence 当作可执行块", () => {
    const nested = `> ${fence(markerJson())}`;
    expect(extractInteractiveMarkers(nested).markers).toHaveLength(0);
    const indented = `    ${fence(markerJson()).split("\n")[0]}\n    x\n    \`\`\``;
    expect(extractInteractiveMarkers(indented).markers).toHaveLength(0);
    const meta = ["```interactive-html title=demo", markerJson(), "```"].join(
      "\n",
    );
    expect(validateMarkerSyntax(meta)).toEqual([
      expect.stringContaining("meta"),
    ]);
  });

  it("超过每篇上限时拒绝", () => {
    const blocks = Array.from({ length: 5 }, (_, index) =>
      fence(markerJson({ id: `demo-${index}` })),
    ).join("\n\n");
    expect(validateMarkerSyntax(blocks)).toEqual([
      expect.stringContaining("最多 4 个互动块"),
    ]);
  });

  it("canonical 输出字段顺序固定且可往返", () => {
    const parsed = parseMarkerJson(markerJson(), { allowLocalPath: false });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const canonical = canonicalizeMarker(parsed.marker);
    expect(canonical).toBe(
      `{"version":1,"id":"demo","sha256":"${SHA}","caption":"排队延迟","summary":"拖动滑块观察等待时间"}`,
    );
    const roundTrip = parseMarkerJson(canonical, { allowLocalPath: false });
    expect(roundTrip.ok && roundTrip.marker).toEqual(parsed.marker);
    expect(canonicalFence(parsed.marker)).toBe(fence(canonical));
  });

  it("本地路径拒绝绝对路径、穿越与协议", () => {
    expect(isSafeLocalHtmlPath("assets/demo.html")).toBe(true);
    expect(isSafeLocalHtmlPath("/etc/passwd.html")).toBe(false);
    expect(isSafeLocalHtmlPath("../demo.html")).toBe(false);
    expect(isSafeLocalHtmlPath("assets/../../demo.html")).toBe(false);
    expect(isSafeLocalHtmlPath("https://example.com/demo.html")).toBe(false);
    expect(isSafeLocalHtmlPath("assets/demo.htm")).toBe(false);
  });

  it("Agent 投影只保留可见标题与说明", () => {
    const markdown = `前言\n\n${fence(markerJson())}\n\n结尾`;
    const projected = projectInteractiveHtmlForAgent(markdown);
    expect(projected).toContain("交互示例：排队延迟。");
    expect(projected).toContain("说明：拖动滑块观察等待时间。");
    expect(projected).not.toContain(SHA);
    expect(projected).not.toContain("```interactive-html");
  });
});

describe("answer-me-with-html 真实样例", () => {
  it("原始生成文件含隐藏源文，公开副本已清空且校验通过", () => {
    const original = readFileSync(
      ".local/interactive-html-impl/p0/source/am-sample.html",
      "utf8",
    );
    const adapted = readFileSync(
      ".local/interactive-html-impl/p0/source/am-sample.public.html",
      "utf8",
    );
    const sourceBody = (html: string) => {
      const match = html.match(
        /<textarea[^>]*id="am-source"[^>]*>([\s\S]*?)<\/textarea>/,
      );
      return match ? match[1].trim() : "";
    };
    expect(original).toContain('id="am-source"');
    expect(sourceBody(original).length).toBeGreaterThan(0);
    expect(adapted).toContain('id="am-source"');
    expect(sourceBody(adapted)).toBe("");
    // 适配移除的是控件元素本身；脚本里残留的选择器字符串不会执行复制。
    expect(adapted).not.toMatch(/<button[^>]*data-am="copy"/);
    expect(original).toMatch(/<button[^>]*data-am="copy"/);
    expect(adapted.length).toBeLessThan(original.length);
  });
});
