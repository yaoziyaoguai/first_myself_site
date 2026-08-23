import { Pool } from "pg";

export const BLOG_AGENT_POOL_LIMITS = {
  max: 5,
  connectionTimeoutMillis: 3_000,
  query_timeout: 8_000,
  statement_timeout: 8_000,
  idleTimeoutMillis: 30_000,
} as const;

let pool: Pool | undefined;

export function getBlogAgentDatabasePool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Blog Agent runtime storage");
  }

  pool = new Pool({
    connectionString,
    application_name: "first-myself-site-blog-agent",
    ...BLOG_AGENT_POOL_LIMITS,
  });
  return pool;
}
