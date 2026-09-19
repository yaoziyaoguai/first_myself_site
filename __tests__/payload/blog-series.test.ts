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

  it("keeps draft series private while allowing editors to manage them", () => {
    const read = BlogSeries.access?.read;
    expect(typeof read).toBe("function");
    if (typeof read !== "function") return;

    expect(read({ req: { user: null } } as never)).toEqual({
      status: { equals: "published" },
    });
    expect(read({ req: { user: { role: "editor" } } } as never)).toBe(true);
    expect(read({ req: { user: { role: "viewer" } } } as never)).toBe(false);
  });
});
