import type { BlogAgentQueryPool } from "@/lib/blog-agent/repository.postgres";
import {
  assertReferencesReady,
  type Queryable,
  type ReferenceCheck,
} from "./repository.postgres";
import { extractInteractiveMarkers } from "./marker";

/**
 * 写入门禁（§3.7 / §3.8）。
 *
 * 两层语义：
 * - 语法校验始终执行：坏 marker、重复 id、超量都不允许进入任何文章。
 * - 资源齐全只对“将要公开/将要 ready”的状态执行；私有草稿允许尚未上传，
 *   完成度由当前正文与资源实时推导，不新增数据库状态列。
 *
 * 数据库检查一律在调用方事务内、用同一 client 完成；这里不新开连接，
 * 也不对同一 Blog 加第二把锁，避免与现有事务互相等待。
 */

export type InteractiveGatePhase = "syntax" | "ready";

export type InteractiveGateInput = {
  /** 合并 data/originalDoc 后的最终正文。 */
  markdown: unknown;
  /** 合并 data/originalDoc 后的最终状态。 */
  status: unknown;
  /** 合并 data/originalDoc 后的最终可见性。 */
  visibility: unknown;
  /** 文章 ID；create 阶段可能还不存在。 */
  blogId?: string | number | null;
  /** 本次写入是否在把 Agent 索引切到 ready。 */
  willWriteReadyIndex?: boolean;
};

export function requiresReadyReferences(input: InteractiveGateInput): boolean {
  if (input.willWriteReadyIndex) return true;
  return input.status !== "draft" || input.visibility !== "private";
}

/** 纯语法校验：任何写入都必须通过。 */
export function checkInteractiveSyntax(markdown: unknown): string[] {
  if (typeof markdown !== "string" || markdown.length === 0) return [];
  return extractInteractiveMarkers(markdown, { allowLocalPath: false }).errors;
}

function formatReferenceFailure(
  check: Extract<ReferenceCheck, { ok: false }>,
): string {
  const parts = [...check.invalid];
  if (check.missing.length > 0) {
    parts.push(
      `互动资源尚未上传: ${check.missing.map((sha) => sha.slice(0, 12)).join(", ")}`,
    );
  }
  return `互动内容校验未通过：${parts.join("；")}`;
}

/**
 * 完整门禁：语法 + （需要时）当前文章绑定与资源存在性。
 * 返回 ok:false 表示应当拒绝本次写入。
 */
export async function checkInteractiveGate(
  queryable: Queryable,
  input: InteractiveGateInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (typeof input.markdown !== "string" || !input.markdown.trim())
    return { ok: true };
  const { markers, errors: syntax } = extractInteractiveMarkers(input.markdown, {
    allowLocalPath: false,
  });
  if (syntax.length > 0) {
    return { ok: false, message: `互动内容格式错误：${syntax.join("；")}` };
  }
  // 普通新文章没有资源要绑定，不应因为尚未分配 ID 而被新功能拦截。
  if (markers.length === 0) return { ok: true };
  if (!requiresReadyReferences(input)) return { ok: true };
  if (input.blogId === undefined || input.blogId === null) {
    return {
      ok: false,
      message: "公开文章必须先保存并获得文章 ID，才能绑定互动资源",
    };
  }
  const check = await assertReferencesReady(
    queryable,
    String(input.blogId),
    input.markdown,
  );
  if (!check.ok) return { ok: false, message: formatReferenceFailure(check) };
  return { ok: true };
}

/**
 * 私有草稿的“待上传”提示：只读取元数据，不阻止保存。
 * 返回缺失的 hash 列表，供后台/发布器展示完成度。
 */
export async function pendingInteractiveReferences(
  queryable: Queryable,
  blogId: string | number,
  markdown: unknown,
): Promise<string[]> {
  if (typeof markdown !== "string" || !markdown) return [];
  const { errors } = extractInteractiveMarkers(markdown, {
    allowLocalPath: false,
  });
  if (errors.length > 0) return [];
  const check = await assertReferencesReady(
    queryable,
    String(blogId),
    markdown,
  );
  return check.ok ? [] : check.missing;
}

/** 供 hooks 使用的共享查询入口：复用现有 Blog Agent 连接池。 */
export function interactiveQueryable(pool: BlogAgentQueryPool): Queryable {
  return {
    query: (text, values) =>
      pool
        .query(text, values as unknown[])
        .then((result) => ({ rows: result.rows })),
  };
}
