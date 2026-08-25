import { describe, expect, it } from "vitest";
import PageViews from "@/payload/collections/PageViews";

describe("PageViews collection", () => {
  it("is admin-readable but cannot be forged through the public Payload API", () => {
    const access = PageViews.access!;
    const anonymousRequest = { req: { user: null } } as never;
    const adminRequest = { req: { user: { role: "admin" } } } as never;

    expect(access.read!(anonymousRequest)).toBe(false);
    expect(access.read!(adminRequest)).toBe(true);
    expect(access.create!(adminRequest)).toBe(false);
    expect(access.update!(adminRequest)).toBe(false);
  });

  it("shows the summary above useful visit-detail columns", () => {
    expect(PageViews.labels).toEqual({
      singular: "访问记录",
      plural: "访问统计",
    });
    expect(PageViews.admin?.components?.beforeList).toEqual([
      "@/payload/components/AnalyticsSummary#AnalyticsSummary",
    ]);
    expect(PageViews.admin?.defaultColumns).toEqual([
      "path",
      "title",
      "networkPrefix",
      "isOwner",
      "engagedSeconds",
      "maxScrollDepth",
      "createdAt",
    ]);
    const fields = PageViews.fields.filter(
      (field) => "name" in field &&
        (field.name === "networkPrefix" || field.name === "isOwner"),
    );
    expect(fields).toEqual([
      expect.objectContaining({
        name: "networkPrefix",
        label: "脱敏网段",
        type: "text",
        admin: expect.objectContaining({ readOnly: true }),
      }),
      expect.objectContaining({
        name: "isOwner",
        label: "站长访问",
        type: "checkbox",
        defaultValue: false,
        admin: expect.objectContaining({ readOnly: true }),
      }),
    ]);
  });
});
