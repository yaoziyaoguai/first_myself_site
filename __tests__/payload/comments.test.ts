import { describe, expect, it, vi } from "vitest";

vi.mock("payload", () => ({ buildConfig: vi.fn((config) => config) }));

import Comments from "@/payload/collections/Comments";

type NamedField = {
  name?: string;
  type: string;
  maxLength?: number;
  options?: unknown[];
};

describe("Comments Collection", () => {
  const fields = Comments.fields as unknown as NamedField[];

  it("defines the moderation and public-content fields", () => {
    expect(Comments.slug).toBe("comments");
    expect(fields.map((field) => field.name)).toEqual(
      expect.arrayContaining([
        "targetId",
        "targetType",
        "content",
        "ipHash",
        "authorName",
        "isDeleted",
      ]),
    );
  });

  it("denies anonymous collection reads and creates", () => {
    expect(Comments.access?.read?.({ req: { user: null } } as never)).toBe(false);
    expect(Comments.access?.create?.({ req: { user: null } } as never)).toBe(false);
  });

  it("allows admin and editor moderation reads", () => {
    for (const role of ["admin", "editor"]) {
      expect(
        Comments.access?.read?.({ req: { user: { role } } } as never),
      ).toBe(true);
    }
  });

  it("restricts update and hard delete to admin", () => {
    expect(
      Comments.access?.update?.({ req: { user: { role: "editor" } } } as never),
    ).toBe(false);
    expect(
      Comments.access?.update?.({ req: { user: { role: "admin" } } } as never),
    ).toBe(true);
    expect(
      Comments.access?.delete?.({ req: { user: { role: "admin" } } } as never),
    ).toBe(true);
  });

  it("keeps content and target validation configuration", () => {
    expect(Comments.hooks?.beforeValidate?.length).toBeGreaterThan(0);
    expect(fields.find((field) => field.name === "content")?.maxLength).toBe(1000);
    expect(fields.find((field) => field.name === "targetType")?.options).toEqual(
      expect.arrayContaining([
        { label: "博客文章", value: "blog" },
        { label: "项目", value: "project" },
      ]),
    );
  });
});
