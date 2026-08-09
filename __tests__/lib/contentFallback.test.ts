import { describe, expect, it } from "vitest";
import {
  resolveArray,
  resolveText,
} from "@/lib/contentFallback";

describe("content fallback", () => {
  it("uses defaults for missing, blank, and empty values", () => {
    expect(resolveText(undefined, "默认介绍")).toBe("默认介绍");
    expect(resolveText("   ", "默认介绍")).toBe("默认介绍");
    expect(resolveArray([], ["默认方向"])).toEqual(["默认方向"]);
  });

  it("preserves meaningful CMS values", () => {
    const directions = ["数据工程", "Agent"];

    expect(resolveText("CMS 介绍", "默认介绍")).toBe("CMS 介绍");
    expect(resolveArray(directions, ["默认方向"])).toBe(directions);
  });
});
