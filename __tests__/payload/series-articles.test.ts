import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSeriesArticles, saveSeriesArticles } from "@/payload/hooks/seriesArticles";

const find = vi.fn();
const update = vi.fn();
const req = { user: { role: "editor" }, payload: { find, update }, transactionID: "shared-transaction" };
const save = (data: Record<string, unknown>) => saveSeriesArticles({ data, doc: { id: 10 }, req } as never);

describe("editing articles from a series", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("does not change membership when only the series title is edited", async () => {
    await save({ title: "新名称" });
    expect(find).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("reopens the current order, including draft articles, without leaking membership to visitors", async () => {
    find.mockResolvedValue({ docs: [{ id: 2, seriesOrder: 2 }, { id: 1, seriesOrder: 1 }] });
    expect(await readSeriesArticles({ data: { id: 10 }, req } as never)).toEqual([1, 2]);
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ depth: 0, overrideAccess: false, req }));
    find.mockClear();
    expect(await readSeriesArticles({ data: { id: 10 }, req: { ...req, user: null } } as never)).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });

  it("adds, removes and reorders using the same transaction without changing article content or visibility", async () => {
    find.mockResolvedValueOnce({ docs: [{ id: 1 }, { id: 2 }] });
    find.mockResolvedValueOnce({ docs: [{ id: 2, series: 10, seriesOrder: 2 }, { id: 3, series: null }] });
    expect(await save({ articles: [3, 2] })).toEqual({ id: 10, articles: [3, 2] });
    expect(update.mock.calls.map(([args]) => ({ id: args.id, data: args.data }))).toEqual([
      { id: 1, data: { series: null, seriesOrder: null } },
      { id: 3, data: { series: 10, seriesOrder: 1 } },
    ]);
    for (const [args] of update.mock.calls) {
      expect(args.req).toBe(req);
      expect(args.overrideAccess).toBe(false);
    }
  });

  it("removes all articles when the selection is explicitly cleared", async () => {
    find.mockResolvedValueOnce({ docs: [{ id: 1, series: 10 }] });
    await save({ articles: null });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: 1, data: { series: null, seriesOrder: null } }));
  });

  it("does not silently move an article out of another series", async () => {
    find.mockResolvedValueOnce({ docs: [{ id: 1, series: 10 }] });
    find.mockResolvedValueOnce({ docs: [{ id: 2, title: "已有归属的文章", series: 99 }] });
    await expect(save({ articles: [2] })).rejects.toThrow("已属于其他合集");
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects unavailable and duplicate articles before altering membership", async () => {
    find.mockResolvedValue({ docs: [] });
    await expect(save({ articles: [404] })).rejects.toThrow("已被删除或无法访问");
    await expect(save({ articles: [1, "1"] })).rejects.toThrow("不能重复");
    expect(update).not.toHaveBeenCalled();
  });

  it("propagates a write failure so Payload rolls back the whole series save", async () => {
    find.mockResolvedValueOnce({ docs: [{ id: 1, series: 10 }] });
    find.mockResolvedValueOnce({ docs: [{ id: 2, series: null }] });
    update.mockRejectedValueOnce(new Error("transaction write failed"));
    await expect(save({ articles: [2] })).rejects.toThrow("transaction write failed");
    expect(update).toHaveBeenCalledTimes(1);
  });
});
