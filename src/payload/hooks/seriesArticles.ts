import { APIError, type CollectionAfterChangeHook, type FieldHook } from "payload";
import { sortSeriesArticles } from "@/lib/blogSeries";

export const readSeriesArticles: FieldHook = async ({ data, req }) => {
  if (!data?.id || req.user?.role !== "admin") return [];
  const { docs } = await req.payload.find({
    collection: "blog",
    where: { series: { equals: data.id } },
    pagination: false,
    depth: 0,
    select: { seriesOrder: true, publishedDate: true },
    overrideAccess: false,
    req,
  });
  return sortSeriesArticles(docs).map((article) => article.id);
};

export const saveSeriesArticles: CollectionAfterChangeHook = async ({ data, doc, req }) => {
  // 未传这个虚拟字段的 API 更新只修改合集信息，不应清空已有文章。
  if (data.articles === undefined) return doc;
  if (!Array.isArray(data.articles) && data.articles !== null) {
    throw new APIError("请选择要加入合集的文章。", 400);
  }
  const ids: (string | number)[] = data.articles ?? [];
  if (ids.some((id) => typeof id !== "number" && typeof id !== "string") ||
      new Set(ids.map(String)).size !== ids.length) {
    throw new APIError("合集文章不能重复，请重新选择。", 400);
  }

  const { docs: current } = await req.payload.find({
    collection: "blog",
    where: { series: { equals: doc.id } },
    pagination: false,
    depth: 0,
    select: { title: true, series: true, seriesOrder: true },
    overrideAccess: false,
    req,
  });
  const selected = ids.length ? (await req.payload.find({
    collection: "blog",
    where: { id: { in: ids } },
    pagination: false,
    depth: 0,
    select: { title: true, series: true, seriesOrder: true },
    overrideAccess: false,
    req,
  })).docs : [];
  if (selected.length !== ids.length) {
    throw new APIError("部分文章已被删除或无法访问，请刷新后重新选择。", 400);
  }
  const occupied = selected.find((article) => article.series != null && String(article.series) !== String(doc.id));
  if (occupied) {
    throw new APIError(`「${occupied.title}」已属于其他合集，请先从原合集移除。`, 400);
  }

  // 复用文章上的唯一归属；传递同一个 req，让合集与全部排序在同一事务中保存。
  for (const article of current) {
    if (!ids.some((id) => String(id) === String(article.id))) {
      await req.payload.update({
        collection: "blog", id: article.id,
        data: { series: null, seriesOrder: null },
        depth: 0, overrideAccess: false, req,
      });
    }
  }
  for (const [index, id] of ids.entries()) {
    const article = selected.find((item) => String(item.id) === String(id))!;
    if (String(article.series) === String(doc.id) && article.seriesOrder === index + 1) continue;
    await req.payload.update({
      collection: "blog", id,
      data: { series: doc.id, seriesOrder: index + 1 },
      depth: 0, overrideAccess: false, req,
    });
  }
  return { ...doc, articles: ids };
};
