import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CollectionConfig } from "payload";

// Mock payload config
vi.mock("payload", () => ({
  buildConfig: vi.fn((config) => config),
}));

// Import the collection to test
import Comments from "@/src/payload/collections/Comments";

describe("Comments Collection", () => {
  it("should have correct slug", () => {
    expect(Comments.slug).toBe("comments");
  });

  it("should have required fields defined", () => {
    const fields = Comments.fields || [];
    const fieldNames = fields.map((f: { name?: string }) => f.name);

    expect(fieldNames).toContain("targetId");
    expect(fieldNames).toContain("targetType");
    expect(fieldNames).toContain("content");
    expect(fieldNames).toContain("ipHash");
    expect(fieldNames).toContain("authorName");
    expect(fieldNames).toContain("isDeleted");
  });

  it("should allow anonymous create access", () => {
    const createAccess = Comments.access?.create;
    expect(createAccess).toBeDefined();

    if (typeof createAccess === "function") {
      const result = createAccess({ req: { user: null } as any });
      expect(result).toBe(true);
    }
  });

  it("should allow public read access", () => {
    const readAccess = Comments.access?.read;
    expect(readAccess).toBeDefined();

    if (typeof readAccess === "function") {
      const result = readAccess({ req: { user: null } as any });
      expect(result).toBe(true);
    }
  });

  it("should restrict update to admin only", () => {
    const updateAccess = Comments.access?.update;
    expect(updateAccess).toBeDefined();

    if (typeof updateAccess === "function") {
      // Anonymous user cannot update
      const anonResult = updateAccess({
        req: { user: null } as any,
        data: {},
        doc: {},
        id: "test-id",
      });
      expect(anonResult).toBe(false);

      // Admin can update
      const adminResult = updateAccess({
        req: { user: { role: "admin" } } as any,
        data: {},
        doc: {},
        id: "test-id",
      });
      expect(adminResult).toBe(true);
    }
  });

  it("should have beforeValidate hook", () => {
    expect(Comments.hooks?.beforeValidate).toBeDefined();
    expect(Comments.hooks?.beforeValidate?.length).toBeGreaterThan(0);
  });

  describe("Field validations", () => {
    it("should have content maxLength of 1000", () => {
      const contentField = Comments.fields?.find(
        (f: { name?: string }) => f.name === "content"
      );
      expect(contentField).toBeDefined();
      expect(contentField?.type).toBe("textarea");
      expect((contentField as any).maxLength).toBe(1000);
    });

    it("should have targetType with correct options", () => {
      const targetTypeField = Comments.fields?.find(
        (f: { name?: string }) => f.name === "targetType"
      );
      expect(targetTypeField).toBeDefined();
      expect(targetTypeField?.type).toBe("select");

      const options = (targetTypeField as any).options;
      expect(options).toContainEqual({ label: "博客文章", value: "blog" });
      expect(options).toContainEqual({ label: "项目", value: "project" });
    });
  });
});
