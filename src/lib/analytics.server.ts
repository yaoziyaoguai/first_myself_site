import type { AnalyticsEvent } from "./analytics";
import { getPayloadAPI } from "./payload";

type PersistedPageView = { id: number };

export type AnalyticsSummary = {
  views: number;
  visitors: number;
  averageEngagedSeconds: number;
  averageScrollDepth: number;
  recentViews: number;
  topPages: Array<{ path: string; title: string; views: number }>;
};

async function persistPageView(event: AnalyticsEvent, visitorHash: string) {
  const payload = await getPayloadAPI();
  const engagedSeconds = event.event === "heartbeat" ? event.engagedSeconds : 0;
  const scrollDepth = event.event === "heartbeat" ? event.scrollDepth : 0;

  // 一个原子 upsert 同时处理重试、heartbeat 先到和并发最大值合并。
  // visitor_hash 条件阻止伪造 sessionId 的请求修改其他访客记录。
  const result = await payload.db.pool.query<PersistedPageView>(
    `
      INSERT INTO page_views (
        session_id,
        visitor_hash,
        path,
        title,
        referrer_host,
        engaged_seconds,
        max_scroll_depth,
        last_seen_at,
        updated_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
      ON CONFLICT (session_id) DO UPDATE SET
        path = EXCLUDED.path,
        title = EXCLUDED.title,
        referrer_host = EXCLUDED.referrer_host,
        engaged_seconds = GREATEST(page_views.engaged_seconds, EXCLUDED.engaged_seconds),
        max_scroll_depth = GREATEST(page_views.max_scroll_depth, EXCLUDED.max_scroll_depth),
        last_seen_at = NOW(),
        updated_at = NOW()
      WHERE page_views.visitor_hash = EXCLUDED.visitor_hash
      RETURNING id
    `,
    [
      event.sessionId,
      visitorHash,
      event.path,
      event.title,
      event.referrerHost,
      engagedSeconds,
      scrollDepth,
    ],
  );

  return result.rows[0] ?? null;
}

export function recordPageView(event: AnalyticsEvent, visitorHash: string) {
  return persistPageView(event, visitorHash);
}

export function updatePageView(event: AnalyticsEvent, visitorHash: string) {
  return persistPageView(event, visitorHash);
}

export async function readAnalyticsSummary(
  since: Date,
  recentSince: Date,
): Promise<AnalyticsSummary> {
  const payload = await getPayloadAPI();
  const totals = await payload.db.pool.query<{
    views: number;
    visitors: number;
    average_engaged_seconds: number;
    average_scroll_depth: number;
    recent_views: number;
  }>(
    `
      SELECT
        COUNT(*)::int AS views,
        COUNT(DISTINCT visitor_hash)::int AS visitors,
        COALESCE(ROUND(AVG(engaged_seconds)), 0)::int AS average_engaged_seconds,
        COALESCE(ROUND(AVG(max_scroll_depth)), 0)::int AS average_scroll_depth,
        COUNT(*) FILTER (WHERE created_at >= $2)::int AS recent_views
      FROM page_views
      WHERE created_at >= $1
    `,
    [since, recentSince],
  );
  const topPages = await payload.db.pool.query<{
    path: string;
    title: string;
    views: number;
  }>(
    `
      SELECT
        path,
        COALESCE(MAX(NULLIF(title, '')), path) AS title,
        COUNT(*)::int AS views
      FROM page_views
      WHERE created_at >= $1
      GROUP BY path
      ORDER BY views DESC, path ASC
      LIMIT 5
    `,
    [since],
  );
  const row = totals.rows[0];

  return {
    views: row?.views ?? 0,
    visitors: row?.visitors ?? 0,
    averageEngagedSeconds: row?.average_engaged_seconds ?? 0,
    averageScrollDepth: row?.average_scroll_depth ?? 0,
    recentViews: row?.recent_views ?? 0,
    topPages: topPages.rows,
  };
}
