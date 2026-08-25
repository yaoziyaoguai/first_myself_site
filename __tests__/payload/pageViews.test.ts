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
    expect(PageViews.admin?.pagination?.defaultLimit).toBe(25);
    expect(PageViews.admin?.defaultColumns).toEqual([
      "path",
      "visitorLabel",
      "networkPrefix",
      "isOwner",
      "engagedSeconds",
      "maxScrollDepth",
      "lastSeenAt",
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

    const visitorLabel = PageViews.fields.find(
      (field) => "name" in field && field.name === "visitorLabel",
    );
    expect(visitorLabel).toEqual(
      expect.objectContaining({
        name: "visitorLabel",
        label: "匿名访客",
        type: "text",
        virtual: true,
        admin: expect.objectContaining({ readOnly: true }),
      }),
    );
    if (!visitorLabel || !("hooks" in visitorLabel)) {
      throw new Error("visitorLabel hook missing");
    }
    const afterRead = visitorLabel.hooks?.afterRead?.[0];
    expect(
      afterRead?.({
        data: { visitorHash: "abcdef12".padEnd(64, "0") },
      } as never),
    ).toBe("访客 ABCDEF12");
  });
});
