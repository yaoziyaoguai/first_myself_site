import { describe, expect, it } from "vitest";
import Blog, {
  enforceBlogAgentPublicationGate,
  prepareBlogAgentIndexState,
} from "@/payload/collections/Blog";

describe("Blog Agent publication gate", () => {
  it("keeps index fields private from anonymous collection reads", () => {
    for (const name of [
      "agentContextRequired",
      "agentPackageHash",
      "agentIndexStatus",
      "agentIndexedPackageHash",
      "agentIndexedAt",
    ]) {
      const field = Blog.fields.find((candidate) => "name" in candidate && candidate.name === name);
      expect(field).toBeDefined();
      if (!field || !("access" in field)) throw new Error(`Missing access for ${name}`);
      const read = field.access?.read;
      expect(read?.({ req: { user: null } } as never)).toBe(false);
      expect(read?.({ req: { user: { role: "editor" } } } as never)).toBe(true);
    }
  });

  it("refuses a public article whose required package is not ready", () => {
    expect(() => enforceBlogAgentPublicationGate({
      data: {
        status: "published",
        visibility: "public",
        agentContextRequired: true,
        agentPackageHash: "a".repeat(64),
        agentIndexStatus: "pending",
        agentIndexedPackageHash: null,
      },
    })).toThrow("文章包索引尚未就绪");
  });

  it("uses final update state and allows only an exact ready hash", () => {
    const originalDoc = {
      status: "draft",
      visibility: "private",
      agentContextRequired: true,
      agentPackageHash: "a".repeat(64),
      agentIndexStatus: "ready",
      agentIndexedPackageHash: "a".repeat(64),
    };

    expect(() => enforceBlogAgentPublicationGate({
      data: { status: "published", visibility: "public" },
      originalDoc,
    })).not.toThrow();
    expect(() => enforceBlogAgentPublicationGate({
      data: { status: "published", visibility: "public", agentIndexedPackageHash: "b".repeat(64) },
      originalDoc,
    })).toThrow("文章包索引尚未就绪");
  });

  it("invalidates readiness when Markdown or the expected package hash changes", () => {
    expect(prepareBlogAgentIndexState({
      data: { contentMarkdown: "new", agentPackageHash: "b".repeat(64) },
      originalDoc: {
        contentMarkdown: "old",
        agentContextRequired: true,
        agentPackageHash: "a".repeat(64),
        agentIndexStatus: "ready",
        agentIndexedPackageHash: "a".repeat(64),
        agentIndexedAt: "2026-08-23T00:00:00.000Z",
      },
    })).toEqual(expect.objectContaining({
      agentIndexStatus: "pending",
      agentIndexedPackageHash: null,
      agentIndexedAt: null,
    }));
  });
});
