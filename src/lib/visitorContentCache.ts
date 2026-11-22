import { cache } from "react";
import type { GlobalAfterChangeHook, SelectType } from "payload";
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
 * 实现注（两条惰性加载边界，勿改回静态引入）：
 * 1. `next/cache`：集合/全局配置文件会 import 本模块，而 Payload CLI
 *    （`payload run`）在纯 node 环境加载真实配置做冒烟——静态引入会把
 *    Next 服务端内部拖进非 Next 运行时导致挂起。
 * 2. `@/lib/payload`：本模块被集合配置（Blog.ts 等）引用，若静态引入
 *    `@/lib/payload`（它引 @payload-config）会形成求值期循环：
 *    payload.config → Blog → 本模块 → @/lib/payload → payload.config（partial），
 *    使 config.collections 里出现 undefined，在 CI 的测试导入顺序下必炸。
 *    函数体内动态 import 只在首次调用时解析，此时模块图已完整，
 *    且 vitest 对 "@/lib/payload" 的 mock 对动态 import 同样生效。
 */

async function getPayloadInstance() {
  // 动态引入保持两个性质：不与集合配置形成求值期循环；vitest 对
  // "@/lib/payload" 的模块 mock 对动态 import 同样生效（BlogPage 等测试依赖此缝）
  const { getPayloadAPI } = await import("@/lib/payload");
  return getPayloadAPI();
}

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

// 与 buildBlogFrontendWhere 的 viewer 形参保持同一类型，避免手写结构类型产生偏差
export const revalidateVisitorGlobal: GlobalAfterChangeHook = async ({ doc, req }) => {
  // 启动回填和命令行 seed 使用 Local API，没有 Next 请求上下文。
  if (req.payloadAPI !== "local") await revalidateVisitorContent();
  return doc;
};

type MaybeViewer = Parameters<typeof buildBlogFrontendWhere>[0];

interface ListOpts {
  limit: number;
  depth: 0 | 1;
  sort?: string;
  seriesId?: number | string;
  summary?: true;
}

const articleIndexSelect = {
  slug: true,
  title: true,
  excerpt: true,
  publishedDate: true,
  readingTime: true,
  tags: true,
  series: true,
  seriesOrder: true,
} as const;

async function findBlogPostsDirect(opts: ListOpts, viewer: MaybeViewer = null) {
  const payload = await getPayloadInstance();
  return payload.find<"blog", SelectType>({
    collection: "blog",
    ...(!viewer && !BYPASS_CACHE ? { overrideAccess: false } : {}),
    where: {
      ...buildBlogFrontendWhere(viewer),
      ...(opts.seriesId !== undefined ? { series: { equals: opts.seriesId } } : {}),
    },
    sort: opts.sort,
    limit: opts.limit,
    depth: opts.depth,
    ...(opts.summary ? { select: articleIndexSelect } : {}),
  });
}

async function findBlogPostBySlugDirect(slug: string) {
  const payload = await getPayloadInstance();
  const result = await payload.find({
    collection: "blog",
    overrideAccess: false,
    where: { ...buildBlogFrontendWhere(null), slug: { equals: slug } },
    limit: 1,
  });
  return result.docs[0] ?? null;
}

function visitorQuery<Args extends unknown[], Result>(
  key: string,
  query: (...args: Args) => Promise<Result>,
) {
  let cached: typeof query;
  return async (...args: Args) => {
    if (!cached) {
      const { unstable_cache } = await import("next/cache");
      cached = unstable_cache(query, [key], {
        tags: [CACHE_TAG],
        revalidate: REVALIDATE_SECONDS,
      });
    }
    return cached(...args);
  };
}

const findBlogPostsCached = visitorQuery("blog-posts-visitor", (opts: ListOpts) =>
  findBlogPostsDirect(opts),
);
const findBlogPostBySlugCached = visitorQuery("blog-post-by-slug-visitor", findBlogPostBySlugDirect);

type PublicGlobal = "home" | "site-settings" | "about" | "contact";
function publicGlobal<Slug extends PublicGlobal>(slug: Slug) {
  const direct = async () => {
    const payload = await getPayloadInstance();
    return payload.findGlobal({ slug });
  };
  const cached = visitorQuery(`global-visitor-${slug}`, direct);
  return cache((viewer: MaybeViewer) => viewer || BYPASS_CACHE ? direct() : cached());
}

async function findProjectsDirect(limit: number) {
  const payload = await getPayloadInstance();
  return payload.find({ collection: "projects", sort: "sortOrder", limit, depth: 0 });
}
const findProjectsCached = visitorQuery("projects-visitor", findProjectsDirect);

async function findPublishedSeriesDirect(slug: string) {
  const payload = await getPayloadInstance();
  const { docs } = await payload.find({
    collection: "blog-series",
    where: { slug: { equals: slug }, status: { equals: "published" } },
    limit: 1,
    depth: 0,
  });
  return docs[0] ?? null;
}
const findPublishedSeriesCached = visitorQuery(
  "published-series-by-slug",
  findPublishedSeriesDirect,
);

export function findBlogPostsForViewer(viewer: MaybeViewer, opts: ListOpts) {
  return viewer || BYPASS_CACHE ? findBlogPostsDirect(opts, viewer) : findBlogPostsCached(opts);
}

export function findArticleIndexForViewer(viewer: MaybeViewer) {
  return findBlogPostsForViewer(viewer, { sort: "-publishedDate", limit: 500, depth: 1, summary: true });
}

/** 单篇文章查询：登录态直查，访客走缓存 */
export async function findBlogPostBySlugForViewer(viewer: MaybeViewer, slug: string) {
  if (viewer || BYPASS_CACHE) {
    const payload = await getPayloadInstance();
    const result = await payload.find({
      collection: "blog",
      where: { ...buildBlogFrontendWhere(viewer), slug: { equals: slug } },
      limit: 1,
    });
    return result.docs[0] ?? null;
  }
  return findBlogPostBySlugCached(slug);
}

export const findHomeGlobalForViewer = publicGlobal("home");
export const findSiteSettingsForViewer = publicGlobal("site-settings");
export const findAboutGlobalForViewer = publicGlobal("about");
export const findContactGlobalForViewer = publicGlobal("contact");

export function findProjectsForViewer(viewer: MaybeViewer, limit = 4) {
  return viewer || BYPASS_CACHE ? findProjectsDirect(limit) : findProjectsCached(limit);
}

export const findPublishedSeriesBySlug = cache((viewer: MaybeViewer, slug: string) =>
  viewer || BYPASS_CACHE ? findPublishedSeriesDirect(slug) : findPublishedSeriesCached(slug),
);
