import { describe, expect, it } from "vitest";
import { formatSiteDate } from "@/lib/siteDate";

describe("formatSiteDate", () => {
  it("keeps an Asia/Shanghai publication date on the intended calendar day", () => {
    expect(formatSiteDate("2026-08-23")).toBe("2026-08-23");
    expect(formatSiteDate("2026-08-23T00:00:00+08:00")).toBe("2026-08-23");
    expect(formatSiteDate("2026-08-22T16:00:00.000Z")).toBe("2026-08-23");
  });

  it("returns an empty value for an invalid date", () => {
    expect(formatSiteDate("not-a-date")).toBe("");
  });
});
