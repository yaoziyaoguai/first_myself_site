import { describe, it, expect, vi } from "vitest";

// Mock payload config
vi.mock("payload", () => ({
  buildConfig: vi.fn((config) => config),
}));

import type { AccessArgs, SelectField, Field, CompoundIndex } from "payload";
import Likes from "@/payload/collections/Likes";

describe("Likes Collection", () => {
  it("should have correct slug", () => {
    expect(Likes.slug).toBe("likes");
  });

  it("should have required fields defined", () => {
    const fields = Likes.fields || [];
    const fieldNames = fields.map((f: { name?: string }) => f.name);

    expect(fieldNames).toContain("targetId");
    expect(fieldNames).toContain("targetType");
    expect(fieldNames).toContain("ipHash");
    expect(fieldNames).toContain("fingerprint");
  });

  it("should allow anonymous create access", () => {
    const createAccess = Likes.access?.create;
    expect(createAccess).toBeDefined();

    if (typeof createAccess === "function") {
      const result = createAccess({ req: { user: null } } as AccessArgs);
      expect(result).toBe(true);
    }
  });

  it("should allow public read access", () => {
    const readAccess = Likes.access?.read;
    expect(readAccess).toBeDefined();

    if (typeof readAccess === "function") {
      const result = readAccess({ req: { user: null } } as AccessArgs);
      expect(result).toBe(true);
    }
  });

  it("should disallow update access", () => {
    const updateAccess = Likes.access?.update;
    expect(updateAccess).toBeDefined();

    if (typeof updateAccess === "function") {
      const result = updateAccess({ req: { user: { role: "admin" } } } as AccessArgs);
      expect(result).toBe(false);
    }
  });

  it("should disallow delete access", () => {
    const deleteAccess = Likes.access?.delete;
    expect(deleteAccess).toBeDefined();

    if (typeof deleteAccess === "function") {
      const result = deleteAccess({ req: { user: { role: "admin" } } } as AccessArgs);
      expect(result).toBe(false);
    }
  });

  it("should have unique index on target + ip + fingerprint", () => {
    const indexes = Likes.indexes || [];
    expect(indexes.length).toBeGreaterThan(0);

    const uniqueIndex = indexes.find((idx: CompoundIndex) => idx.unique === true);
    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex?.fields).toContain("targetId");
    expect(uniqueIndex?.fields).toContain("targetType");
    expect(uniqueIndex?.fields).toContain("ipHash");
    expect(uniqueIndex?.fields).toContain("fingerprint");
  });

  describe("Field validations", () => {
    it("should have targetType with correct options", () => {
      const targetTypeField = Likes.fields?.find(
        (f: { name?: string }) => f.name === "targetType"
      );
      expect(targetTypeField).toBeDefined();
      expect(targetTypeField?.type).toBe("select");

      const options = (targetTypeField as SelectField).options;
      expect(options).toContainEqual({ label: "博客文章", value: "blog" });
      expect(options).toContainEqual({ label: "项目", value: "project" });
    });

    it("should require all fields", () => {
      const requiredFields = ["targetId", "targetType", "ipHash", "fingerprint"];

      requiredFields.forEach((fieldName) => {
        const field = Likes.fields?.find(
          (f: { name?: string }) => f.name === fieldName
        );
        expect(field).toBeDefined();
        expect((field as Field).required).toBe(true);
      });
    });
  });
});
