/**
 * 前台 Blog 列表 / 详情页的「可见性」过滤构造器
 *
 * ── 为什么需要这个文件 ─────────────────────────────────────────────
 * Payload 的 Local API（`getPayload({ config })`）在没有显式传 req 的
 * 情况下，**默认 `overrideAccess: true`**，也就是说 Collection 上
 * `Blog.access.read` 配置的过滤函数 **不会** 在前台 server component
 * 这条数据链路里生效（它只在 REST/GraphQL HTTP 入口、以及 admin UI
 * 这类 Payload 自己挂载的链路上自动生效）。
 *
 * 因此前台页面必须自己在 `where` 里手动写过滤条件，否则就会把
 * private / draft 一起暴露出来。历史代码硬编码了
 * `visibility: { equals: "public" }`，没有把「当前请求用户是不是作者
 * (admin / editor)」考虑进去，导致作者本人登录后也看不到自己的
 * 「仅自己可见」文章。本文件就是把这一段「前台查询过滤策略」抽离出来，
 * 让它在语义上和 `Blog.access.read` 保持一致：
 *
 *   - 未登录访客：只能看到 `status=published` && `visibility=public`
 *   - 普通登录用户（viewer 等非 admin/editor 角色）：同上
 *     （Blog.access.read 对这类角色返回 false，但前台是「公开内容」
 *      入口，不应该把公开文章也挡掉，所以这里仍按公开规则放行）
 *   - 作者本人（admin） / 编辑者（editor）：去掉 visibility 过滤，
 *     依旧保留 `status=published`（草稿不进前台列表，符合 publish 工作流；
 *     如需在前台预览草稿应走 Payload 的 draft/preview 机制，与本修复无关）
 *
 * ── 不做的事 ─────────────────────────────────────────────────────
 * 1. 不修改 `Blog.access.read`，不破坏后台与 REST/GraphQL 的访问控制边界
 * 2. 不放宽到「所有登录用户都能看 private」，只对 admin/editor 放宽，
 *    与 collection 现有语义对齐
 * 3. 不删除 `status` 过滤（草稿不应该出现在前台公开列表里）
 */

/**
 * 前台查询里我们关心的最小用户形状。
 * 这里有意写成宽松的 `Record<string, unknown>`，原因是 Payload 的 `req.user`
 * 目前是 `UntypedUser`（`{ [key: string]: any } & BaseUser`），其结构对 TS
 * 的「object literal contextual typing」并不总是兼容更窄的 `{ role?: unknown }`，
 * 所以用通用 record 来稳妥兼容；运行时再按字段读取 role。
 */
export type FrontendViewer = Record<string, unknown> | null | undefined;

/** 安全地从未知形状的 viewer 中取 role 字段并归一为 string */
function readRole(viewer: FrontendViewer): string | null {
  if (!viewer) return null;
  const role = (viewer as { role?: unknown }).role;
  return typeof role === "string" ? role : null;
}

/** 前台 Blog 查询的 where 子句类型（status 必填，visibility 仅对外部访客必填） */
export type BlogFrontendWhere =
  | { status: { equals: "published" }; visibility: { equals: "public" } }
  | { status: { equals: "published" } };

/**
 * 判断当前查看者是否享有「作者级前台可见性」（可以在前台看到 private 文章）。
 * 与 Blog.access.read 的语义保持一致：admin / editor。
 */
export function canViewPrivateBlog(viewer: FrontendViewer): boolean {
  const role = readRole(viewer);
  if (!role) return false;
  return role === "admin" || role === "editor";
}

/**
 * 构造前台 Blog 列表 / 详情页查询使用的 where 过滤片段。
 *
 * 注意：调用方仍可以在外层叠加额外过滤（例如详情页的 `slug.equals`），
 * 该函数只负责「可见性」这一维度，避免在多个页面散落同样的 if/else。
 */
export function buildBlogFrontendWhere(viewer: FrontendViewer): BlogFrontendWhere {
  if (canViewPrivateBlog(viewer)) {
    return { status: { equals: "published" } };
  }
  return {
    status: { equals: "published" },
    visibility: { equals: "public" },
  };
}
