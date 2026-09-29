import { describe, expect, it } from "vitest";
import Blog from "@/payload/collections/Blog";
import BlogSeries from "@/payload/collections/BlogSeries";

describe("blog series collections", () => {
  it("connects each article to one ordered series", () => {
    expect(Blog.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "series",
          type: "relationship",
          relationTo: "blog-series",
        }),
        expect.objectContaining({ name: "seriesOrder", type: "number", min: 1 }),
      ]),
    );
  });

  it("keeps draft series private and reserves management reads for admins", () => {
    const read = BlogSeries.access?.read;
    expect(typeof read).toBe("function");
    if (typeof read !== "function") return;

    expect(read({ req: { user: null } } as never)).toEqual({
      status: { equals: "published" },
    });
    expect(read({ req: { user: { role: "admin" } } } as never)).toBe(true);
    expect(read({ req: { user: { role: "editor" } } } as never)).toBe(false);
    expect(read({ req: { user: { role: "viewer" } } } as never)).toBe(false);
  });

  it.each([null, "viewer", "editor", "unknown", "admin"])("restricts series management for role %s", (role) => {
    const user = role ? { id: 1, role } : null;
    const args = { req: { user } } as never;
    for (const operation of ["create", "update", "delete"] as const) {
      expect(BlogSeries.access?.[operation]?.(args)).toBe(role === "admin");
    }
    const hidden = BlogSeries.admin?.hidden;
    expect(typeof hidden).toBe("function");
    if (typeof hidden === "function") expect(hidden({ user } as never)).toBe(role !== "admin");
    const articles = BlogSeries.fields.find((field) => "name" in field && field.name === "articles");
    expect(articles && "access" in articles && articles.access?.read?.(args)).toBe(role === "admin");
  });

  it.each(["series", "seriesOrder"])("protects %s from writes through the article API", (name) => {
    const field = Blog.fields.find((field) => "name" in field && field.name === name);
    if (!field || !("access" in field)) throw new Error(`Missing protected field ${name}`);
    for (const role of [null, "viewer", "editor", "unknown", "admin"]) {
      const user = role ? { id: 1, role } : null;
      for (const operation of ["create", "update"] as const) {
        expect(field.access?.[operation]?.({ req: { user } } as never)).toBe(role === "admin");
      }
      expect(field.admin?.condition?.({}, { series: 1 }, { user } as never)).toBe(role === "admin");
    }
  });
});
