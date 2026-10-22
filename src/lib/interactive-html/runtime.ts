import type { BlogAgentQueryPool } from "@/lib/blog-agent/repository.postgres";
import { getBlogAgentDatabasePool } from "@/lib/blog-agent/database";
import { PostgresInteractiveHtmlRepository } from "./repository.postgres";

/**
 * 交互 HTML 存储的进程级单例。
 *
 * 复用现有 Blog Agent 的 PostgreSQL 连接池与限制，不新增数据库或服务；
 * 测试可注入自己的 pool。
 */
let repository: PostgresInteractiveHtmlRepository | undefined;

export function getInteractiveHtmlRepository(
  pool: BlogAgentQueryPool = getBlogAgentDatabasePool(),
): PostgresInteractiveHtmlRepository {
  if (!repository) repository = new PostgresInteractiveHtmlRepository(pool);
  return repository;
}

export function setInteractiveHtmlRepositoryForTests(
  value: PostgresInteractiveHtmlRepository | undefined,
): void {
  repository = value;
}
