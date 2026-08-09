import { describe, expect, it, vi } from "vitest";

vi.mock("payload", () => ({ buildConfig: vi.fn((config) => config) }));

import Likes from "@/payload/collections/Likes";

type NamedField = {
  name?: string;
  type: string;
  required?: boolean;
  options?: unknown[];
};

describe("Likes Collection", () => {
  const fields = Likes.fields as unknown as NamedField[];

  it("defines the anonymous identity fields and unique index", () => {
    expect(Likes.slug).toBe("likes");
    expect(fields.map((field) => field.name)).toEqual(
      expect.arrayContaining(["targetId", "targetType", "ipHash", "fingerprint"]),
    );
    expect(Likes.indexes).toContainEqual({
      fields: ["targetId", "targetType", "ipHash", "fingerprint"],
      unique: true,
    });
  });

  it("denies anonymous collection reads and creates", () => {
    expect(Likes.access?.read?.({ req: { user: null } } as never)).toBe(false);
    expect(Likes.access?.create?.({ req: { user: null } } as never)).toBe(false);
  });

  it("allows admin and editor moderation reads", () => {
    for (const role of ["admin", "editor"]) {
      expect(Likes.access?.read?.({ req: { user: { role } } } as never)).toBe(true);
    }
  });

  it("does not support direct update or delete", () => {
    expect(Likes.access?.update?.({ req: { user: { role: "admin" } } } as never)).toBe(false);
    expect(Likes.access?.delete?.({ req: { user: { role: "admin" } } } as never)).toBe(false);
  });

  it("requires all stored identity fields and validates target type", () => {
    for (const name of ["targetId", "targetType", "ipHash", "fingerprint"]) {
      expect(fields.find((field) => field.name === name)?.required).toBe(true);
    }
    expect(fields.find((field) => field.name === "targetType")?.options).toEqual(
      expect.arrayContaining([
        { label: "博客文章", value: "blog" },
        { label: "项目", value: "project" },
      ]),
    );
  });
});
