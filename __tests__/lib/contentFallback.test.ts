import { describe, expect, it } from "vitest";
import {
  hasMeaningfulContent,
  resolveArray,
  resolveRecord,
  resolveText,
} from "@/lib/contentFallback";

describe("content fallback", () => {
  it("uses defaults for missing, blank, and empty values", () => {
    expect(resolveText(undefined, "默认介绍")).toBe("默认介绍");
    expect(resolveText("   ", "默认介绍")).toBe("默认介绍");
    expect(resolveArray([], ["默认方向"])).toEqual(["默认方向"]);
    expect(hasMeaningfulContent(null)).toBe(false);
  });

  it("preserves meaningful CMS values", () => {
    const directions = ["数据工程", "Agent"];

    expect(resolveText("CMS 介绍", "默认介绍")).toBe("CMS 介绍");
    expect(resolveArray(directions, ["默认方向"])).toBe(directions);
    expect(hasMeaningfulContent(0)).toBe(true);
  });

  it("fills a partial record field by field", () => {
    expect(
      resolveRecord(
        { title: "CMS 标题", description: "  ", items: [] },
        {
          title: "默认标题",
          description: "默认描述",
          items: ["默认项目"],
        },
      ),
    ).toEqual({
      title: "CMS 标题",
      description: "默认描述",
      items: ["默认项目"],
    });
  });
});
