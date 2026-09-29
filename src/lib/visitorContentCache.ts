import { getPayloadAPI } from "@/lib/payload";
import { buildBlogFrontendWhere } from "@/lib/blogVisibility";

/**
 * 访客视角的内容查询缓存。
 *
 * 前台三个核心页面（首页/列表/文章详情）每次请求都全量渲染并查库；
 * 本文件把「未登录访客」的查询结果放进 Next 数据缓存，用 `content` tag 失效，
 * 60 秒 revalidate 兜底（防钩子遗漏造成长期陈旧）。
 *
 * 安全边界：任何登录态（admin/editor/普通用户）都绕过缓存直接查库——
 * private 文章与草稿永远不会进入共享缓存；未登录查询固定使用访客 where。
 * 后台编辑者自己预览时走直查，看到的永远是最新内容。
 *
 * 实现注：`next/cache` 必须惰性动态加载。集合/全局配置文件会 import 本模块，
 * 而 Payload CLI（`payload run`）在纯 node 环境加载真实配置做冒烟——
 * 静态引入 next/cache 会把 Next 服务端内部拖进非 Next 运行时导致挂起。
 */

const CACHE_TAG = "content";
const REVALIDATE_SECONDS = 60;

// vitest/jsdom 环境没有 Next 的 incrementalCache，unstable_cache 会抛不变量错误；
// 测试环境直接走直查（各 *ForViewer 入口统一在此分流）
const BYPASS_CACHE = !!process.env.VITEST;

export function revalidateVisitorContent() {
  return import("next/cache").then(({ revalidateTag }) =>
    // Next 16 的 revalidateTag 第二参为失效档案，{ expire: 0 } 立即过期
    revalidateTag(CACHE_TAG, { expire: 0 }),
  );
}

interface Viewer {
  id: unknown;
  [key: string]: unknown;
}

type MaybeViewer = Viewer | null | undefined;

interface ListOpts {
  limit: number;
  depth: 0 | 1;
  sort?: string;
  seriesId?: number | string;
}

async function findBlogPostsDirect(opts: ListOpts) {
  const payload = await getPayloadAPI();
  const where = buildBlogFrontendWhere(null);
  return payload.find({
    collection: "blog",
    where:
      opts.seriesId !== undefined
        ? { ...where, series: { equals: opts.seriesId } }
        : where,
    sort: opts.sort,
    limit: opts.limit,
    depth: opts.depth,
  });
}

async function findBlogPostBySlugDirect(slug: string) {
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: { ...buildBlogFrontendWhere(null), slug: { equals: slug } },
    limit: 1,
  });
  return result.docs[0] ?? null;
}

// 惰性构建的 unstable_cache 包装：首次调用时才加载 next/cache
const lazy = {} as {
  posts?: (opts: ListOpts) => Promise<Awaited<ReturnType<typeof findBlogPostsDirect>>>;
  postBySlug?: (slug: string) => Promise<Awaited<ReturnType<typeof findBlogPostBySlugDirect>>>;
  homeGlobal?: () => Promise<Awaited<ReturnType<typeof findHomeGlobalDirect>>>;
  projects?: () => Promise<Awaited<ReturnType<typeof findProjectsDirect>>>;
};

async function findBlogPostsCached(opts: ListOpts) {
  if (!lazy.posts) {
    const { unstable_cache } = await import("next/cache");
    lazy.posts = unstable_cache(
      (o: ListOpts) => findBlogPostsDirect(o),
      ["blog-posts-visitor"],
      { tags: [CACHE_TAG], revalidate: REVALIDATE_SECONDS },
    );
  }
  return lazy.posts(opts);
}

async function findBlogPostBySlugCached(slug: string) {
  if (!lazy.postBySlug) {
    const { unstable_cache } = await import("next/cache");
    lazy.postBySlug = unstable_cache(
      (s: string) => findBlogPostBySlugDirect(s),
      ["blog-post-by-slug-visitor"],
      { tags: [CACHE_TAG], revalidate: REVALIDATE_SECONDS },
    );
  }
  return lazy.postBySlug(slug);
}

async function findHomeGlobalDirect() {
  const payload = await getPayloadAPI();
  return payload.findGlobal({ slug: "home" });
}

async function findHomeGlobalCached() {
  if (!lazy.homeGlobal) {
    const { unstable_cache } = await import("next/cache");
    lazy.homeGlobal = unstable_cache(
      () => findHomeGlobalDirect(),
      ["home-global-visitor"],
      { tags: [CACHE_TAG], revalidate: REVALIDATE_SECONDS },
    );
  }
  return lazy.homeGlobal();
}

async function findProjectsDirect() {
  const payload = await getPayloadAPI();
  return payload.find({ collection: "projects", sort: "sortOrder", limit: 4 });
}

async function findProjectsCached() {
  if (!lazy.projects) {
    const { unstable_cache } = await import("next/cache");
    lazy.projects = unstable_cache(
      () => findProjectsDirect(),
      ["projects-visitor"],
      { tags: [CACHE_TAG], revalidate: REVALIDATE_SECONDS },
    );
  }
  return lazy.projects();
}

/** 列表查询：登录态直查，访客走缓存 */
export async function findBlogPostsForViewer(viewer: MaybeViewer, opts: ListOpts) {
  if (viewer || BYPASS_CACHE) {
    const payload = await getPayloadAPI();
    const where = buildBlogFrontendWhere(viewer);
    return payload.find({
      collection: "blog",
      where:
        opts.seriesId !== undefined
          ? { ...where, series: { equals: opts.seriesId } }
          : where,
      sort: opts.sort,
      limit: opts.limit,
      depth: opts.depth,
    });
  }
  return findBlogPostsCached(opts);
}

/** 单篇文章查询：登录态直查，访客走缓存 */
export async function findBlogPostBySlugForViewer(viewer: MaybeViewer, slug: string) {
  if (viewer || BYPASS_CACHE) {
    const payload = await getPayloadAPI();
    const result = await payload.find({
      collection: "blog",
      where: { ...buildBlogFrontendWhere(viewer), slug: { equals: slug } },
      limit: 1,
    });
    return result.docs[0] ?? null;
  }
  return findBlogPostBySlugCached(slug);
}

/** 首页全局配置：登录态直查，访客走缓存 */
export async function findHomeGlobalForViewer(viewer: MaybeViewer) {
  if (viewer || BYPASS_CACHE) {
    return findHomeGlobalDirect();
  }
  return findHomeGlobalCached();
}

/** 项目列表（首页用）：登录态直查，访客走缓存 */
export async function findProjectsForViewer(viewer: MaybeViewer) {
  if (viewer || BYPASS_CACHE) {
    return findProjectsDirect();
  }
  return findProjectsCached();
}
