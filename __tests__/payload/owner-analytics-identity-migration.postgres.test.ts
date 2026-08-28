import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from "../helpers/blogAgentPostgres";

const { mockGetPayloadAPI } = vi.hoisted(() => ({ mockGetPayloadAPI: vi.fn() }));

vi.mock("@/lib/payload", () => ({ getPayloadAPI: mockGetPayloadAPI }));

import {
  readAnalyticsSummary,
  recordPageView,
} from "@/lib/analytics.server";
import {
  down,
  up,
} from "@/payload/migrations/20260828_000000_propagate_owner_analytics";

const describePostgres = process.env.BLOG_AGENT_TEST_DATABASE_URL
  ? describe
  : describe.skip;

describePostgres("owner analytics identity on PostgreSQL 15", () => {
  let database: IsolatedPostgresDatabase;
  const dialect = new PgDialect();

  function migrationDb() {
    return {
      execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        const compiled = dialect.sqlToQuery(query);
        return database.pool.query(compiled.sql, compiled.params);
      },
    };
  }

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase();
    await database.pool.query(`
      CREATE TABLE page_views (
        id serial PRIMARY KEY,
        session_id varchar NOT NULL UNIQUE,
        visitor_hash varchar NOT NULL,
        network_prefix varchar,
        is_owner boolean DEFAULT false NOT NULL,
        path varchar NOT NULL,
        title varchar,
        referrer_host varchar,
        engaged_seconds numeric DEFAULT 0 NOT NULL,
        max_scroll_depth numeric DEFAULT 0 NOT NULL,
        last_seen_at timestamptz NOT NULL,
        updated_at timestamptz DEFAULT NOW() NOT NULL,
        created_at timestamptz DEFAULT NOW() NOT NULL
      )
    `);
    mockGetPayloadAPI.mockResolvedValue({ db: { pool: database.pool } });
  });

  afterAll(async () => {
    if (!database) return;
    await down({ db: migrationDb() } as unknown as MigrateDownArgs);
    await database.destroy();
  });

  it("backfills, inherits, and excludes every known owner row", async () => {
    await database.pool.query(
      `INSERT INTO page_views
        (session_id, visitor_hash, is_owner, path, last_seen_at)
       VALUES
        ('owner-old', 'known-owner', false, '/', NOW()),
        ('owner-authenticated', 'known-owner', true, '/admin', NOW()),
        ('reader', 'reader', false, '/blog/article', NOW())`,
    );

    await up({ db: migrationDb() } as unknown as MigrateUpArgs);
    const backfilled = await database.pool.query<{ is_owner: boolean }>(
      `SELECT is_owner FROM page_views
       WHERE visitor_hash = 'known-owner' ORDER BY session_id`,
    );
    expect(backfilled.rows).toEqual([
      { is_owner: true },
      { is_owner: true },
    ]);

    await recordPageView(
      {
        event: "start",
        sessionId: "owner-after-logout",
        path: "/about",
        title: "About",
        referrerHost: "",
      },
      {
        visitorHash: "known-owner",
        networkPrefix: "203.0.113.0/24",
        isOwner: false,
      },
    );
    const inherited = await database.pool.query<{ is_owner: boolean }>(
      `SELECT is_owner FROM page_views WHERE session_id = 'owner-after-logout'`,
    );
    expect(inherited.rows[0]).toEqual({ is_owner: true });

    await database.pool.query(
      `INSERT INTO page_views
        (session_id, visitor_hash, is_owner, path, last_seen_at)
       VALUES ('runtime-owner-old', 'runtime-owner', false, '/contact', NOW())`,
    );
    await recordPageView(
      {
        event: "start",
        sessionId: "runtime-owner-authenticated",
        path: "/projects",
        title: "Projects",
        referrerHost: "",
      },
      {
        visitorHash: "runtime-owner",
        networkPrefix: "203.0.113.0/24",
        isOwner: true,
      },
    );
    const promoted = await database.pool.query<{ is_owner: boolean }>(
      `SELECT is_owner FROM page_views
       WHERE visitor_hash = 'runtime-owner' ORDER BY session_id`,
    );
    expect(promoted.rows).toEqual([
      { is_owner: true },
      { is_owner: true },
    ]);

    // 模拟迁移后并发窗口遗留的 mixed rows，直接保护汇总查询的防御性排除。
    await database.pool.query(
      `INSERT INTO page_views
        (session_id, visitor_hash, is_owner, path, last_seen_at)
       VALUES
        ('mixed-owner-false', 'mixed-owner', false, '/must-not-leak', NOW()),
        ('mixed-owner-true', 'mixed-owner', true, '/owner', NOW())`,
    );

    const now = Date.now();
    const summary = await readAnalyticsSummary(
      new Date(now - 60_000),
      new Date(now - 60_000),
      new Date(now + 60_000),
    );
    expect(summary.views).toBe(1);
    expect(summary.visitors).toBe(1);
    expect(summary.topPages).toEqual([
      { path: "/blog/article", title: "/blog/article", views: 1 },
    ]);
    expect(summary.dailyViews.reduce((total, item) => total + item.views, 0))
      .toBe(1);
    expect(summary.dailyViews.reduce((total, item) => total + item.visitors, 0))
      .toBe(1);
  });
});
