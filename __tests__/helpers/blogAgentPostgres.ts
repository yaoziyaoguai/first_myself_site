import { randomBytes } from "node:crypto";
import { Pool } from "pg";

export type IsolatedPostgresDatabase = {
  pool: Pool;
  destroy: () => Promise<void>;
};

export async function createIsolatedPostgresDatabase(): Promise<IsolatedPostgresDatabase> {
  const connectionString = process.env.BLOG_AGENT_TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error("BLOG_AGENT_TEST_DATABASE_URL is required");
  }
  const baseUrl = new URL(connectionString);
  if (!decodeURIComponent(baseUrl.pathname).toLocaleLowerCase().includes("test")) {
    throw new Error("Refusing to create integration database from a non-test URL");
  }

  const databaseName = `blog_agent_it_${process.pid}_${randomBytes(6).toString("hex")}`;
  if (!/^blog_agent_it_[a-z0-9_]+$/.test(databaseName)) {
    throw new Error("Invalid generated integration database name");
  }
  const admin = new Pool({ connectionString, max: 1 });
  try {
    await admin.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0`);
  } catch (error) {
    await admin.end();
    throw error;
  }

  const isolatedUrl = new URL(baseUrl);
  isolatedUrl.pathname = `/${databaseName}`;
  const pool = new Pool({ connectionString: isolatedUrl.toString(), max: 5 });
  let destroyed = false;
  return {
    pool,
    destroy: async () => {
      if (destroyed) return;
      destroyed = true;
      await pool.end();
      await admin.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [databaseName],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.end();
    },
  };
}
