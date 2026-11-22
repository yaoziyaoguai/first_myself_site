import { expect, it, vi } from "vitest";
import { GET } from "@/app/api/article-index/route";
import { findArticleIndexForViewer } from "@/lib/visitorContentCache";

vi.mock("@/lib/visitorContentCache", () => ({
  findArticleIndexForViewer: vi.fn().mockResolvedValue({ docs: [] }),
}));

it("reads the public index without allowing stale metadata to be cached by clients or proxies", async () => {
  const response = await GET();

  expect(findArticleIndexForViewer).toHaveBeenCalledWith(null);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual([]);
});
