import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isSafeLocalHtmlPath,
  parseMarkerJson,
} from "@/lib/interactive-html/marker";
import { preparePublicHtml } from "@/lib/interactive-html/profile";

/**
 * 与全局发布 Skill 的 Python 预检共享的契约样例。
 * 修改任一侧实现时必须让这份样例继续通过。
 */

type MarkerCase = {
  name: string;
  json: string;
  ok: boolean;
  canonical?: string;
  errorContains?: string;
  transform?: "repeat-summary-1001";
};

type HtmlCase = {
  name: string;
  file: string;
  ok: boolean;
  adapt: boolean;
  errorCode?: string;
};

const fixtureRoot = "__tests__/fixtures/interactive-html";
const contract = JSON.parse(
  readFileSync(`${fixtureRoot}/markers.json`, "utf8"),
) as {
  markers: MarkerCase[];
  localPaths: Array<{ path: string; ok: boolean }>;
  html: HtmlCase[];
};

function markerJson(testCase: MarkerCase): string {
  if (testCase.transform !== "repeat-summary-1001") return testCase.json;
  return testCase.json.replace(
    '"summary":"S"',
    `"summary":"${"S".repeat(1001)}"`,
  );
}

describe("marker 契约样例", () => {
  it.each(contract.markers.map((item) => [item.name, item] as const))(
    "%s",
    (_name, testCase) => {
      const parsed = parseMarkerJson(markerJson(testCase), {
        allowLocalPath: false,
      });
      expect(parsed.ok).toBe(testCase.ok);
      if (testCase.ok) {
        expect(
          parsed.ok &&
            JSON.stringify(
              parsed.marker && {
                version: parsed.marker.version,
                id: parsed.marker.id,
                sha256: parsed.marker.sha256,
                caption: parsed.marker.caption,
                ...(parsed.marker.summary
                  ? { summary: parsed.marker.summary }
                  : {}),
              },
            ),
        ).toBe(testCase.canonical);
      } else if (testCase.errorContains && !parsed.ok) {
        expect(parsed.reason).toContain(testCase.errorContains);
      }
    },
  );

  it.each(contract.localPaths.map((item) => [item.path, item.ok] as const))(
    "本地路径 %s → %s",
    (path, ok) => {
      expect(isSafeLocalHtmlPath(path)).toBe(ok);
    },
  );
});

describe("公开副本契约样例", () => {
  it.each(contract.html.map((item) => [item.name, item] as const))(
    "%s",
    (_name, testCase) => {
      const bytes = readFileSync(`${fixtureRoot}/${testCase.file}`);
      const prepared = preparePublicHtml(bytes, { adapt: testCase.adapt });
      expect(prepared.ok).toBe(testCase.ok);
      if (!prepared.ok && testCase.errorCode) {
        expect(prepared.issues.map((issue) => issue.code)).toContain(
          testCase.errorCode,
        );
      }
    },
  );

  it("生成器原始文件经适配后与公开副本字节一致", () => {
    const original = readFileSync(
      `${fixtureRoot}/html/generator-original.html`,
    );
    const prepared = preparePublicHtml(original, { adapt: true });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const expected = readFileSync(
      `${fixtureRoot}/html/generator-adapted.html`,
      "utf8",
    );
    expect(prepared.value.html).toBe(expected);
  });
});
