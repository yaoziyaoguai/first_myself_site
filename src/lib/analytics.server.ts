import type { AnalyticsEvent } from "./analytics";
import { getPayloadAPI } from "./payload";

type PersistedPageView = { id: number };

export type AnalyticsIdentity = {
  visitorHash: string;
  networkPrefix: string;
  isOwner: boolean;
};

export type AnalyticsSummary = {
  views: number;
  visitors: number;
  averageEngagedSeconds: number;
  medianEngagedSeconds: number;
  averageScrollDepth: number;
  recentViews: number;
  topPages: Array<{ path: string; title: string; views: number }>;
  dailyViews: Array<{ date: string; views: number; visitors: number }>;
};

const DAY_MS = 24 * 60 * 60 * 1_000;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1_000;

export function startOfShanghaiDayWindow(now: Date, days = 7): Date {
  const shanghai = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  const localMidnight = Date.UTC(
    shanghai.getUTCFullYear(),
    shanghai.getUTCMonth(),
    shanghai.getUTCDate(),
  );
  return new Date(
    localMidnight - SHANGHAI_OFFSET_MS - Math.max(0, days - 1) * DAY_MS,
  );
}

async function persistPageView(
  event: AnalyticsEvent,
  identity: AnalyticsIdentity,
) {
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
        network_prefix,
        is_owner,
        path,
        title,
        referrer_host,
        engaged_seconds,
        max_scroll_depth,
        last_seen_at,
        updated_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())
      ON CONFLICT (session_id) DO UPDATE SET
        network_prefix = EXCLUDED.network_prefix,
        is_owner = page_views.is_owner OR EXCLUDED.is_owner,
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
      identity.visitorHash,
      identity.networkPrefix || null,
      identity.isOwner,
      event.path,
      event.title,
      event.referrerHost,
      engagedSeconds,
      scrollDepth,
    ],
  );

  return result.rows[0] ?? null;
}

export function recordPageView(event: AnalyticsEvent, identity: AnalyticsIdentity) {
  return persistPageView(event, identity);
}

export function updatePageView(event: AnalyticsEvent, identity: AnalyticsIdentity) {
  return persistPageView(event, identity);
}

export async function readAnalyticsSummary(
  since: Date,
  recentSince: Date,
  until: Date,
): Promise<AnalyticsSummary> {
  const payload = await getPayloadAPI();
  const totals = await payload.db.pool.query<{
    views: number;
    visitors: number;
    average_engaged_seconds: number;
    median_engaged_seconds: number;
    average_scroll_depth: number;
    recent_views: number;
  }>(
    `
      SELECT
        COUNT(*)::int AS views,
        COUNT(DISTINCT visitor_hash)::int AS visitors,
        COALESCE(ROUND(AVG(engaged_seconds)), 0)::int AS average_engaged_seconds,
        COALESCE(
          ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY engaged_seconds))::numeric),
          0
        )::int AS median_engaged_seconds,
        COALESCE(ROUND(AVG(max_scroll_depth)), 0)::int AS average_scroll_depth,
        COUNT(*) FILTER (WHERE created_at >= $2)::int AS recent_views
      FROM page_views
      WHERE created_at >= $1
        AND created_at < $3
        AND COALESCE(is_owner, false) = false
    `,
    [since, recentSince, until],
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
        AND created_at < $2
        AND COALESCE(is_owner, false) = false
      GROUP BY path
      ORDER BY views DESC, path ASC
      LIMIT 5
    `,
    [since, until],
  );
  const dailyViews = await payload.db.pool.query<{
    date: string;
    views: number;
    visitors: number;
  }>(
    `
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', $1::timestamptz AT TIME ZONE 'Asia/Shanghai'),
          date_trunc('day', $2::timestamptz AT TIME ZONE 'Asia/Shanghai'),
          INTERVAL '1 day'
        ) AS day
      )
      SELECT
        TO_CHAR(days.day, 'MM-DD') AS date,
        COUNT(page_views.id)::int AS views,
        COUNT(DISTINCT page_views.visitor_hash)::int AS visitors
      FROM days
      LEFT JOIN page_views
        ON page_views.created_at >= days.day AT TIME ZONE 'Asia/Shanghai'
        AND page_views.created_at < (days.day + INTERVAL '1 day') AT TIME ZONE 'Asia/Shanghai'
        AND page_views.created_at < $2
        AND COALESCE(page_views.is_owner, false) = false
      GROUP BY days.day
      ORDER BY days.day ASC
    `,
    [since, until],
  );
  const row = totals.rows[0];

  return {
    views: row?.views ?? 0,
    visitors: row?.visitors ?? 0,
    averageEngagedSeconds: row?.average_engaged_seconds ?? 0,
    medianEngagedSeconds: row?.median_engaged_seconds ?? 0,
    averageScrollDepth: row?.average_scroll_depth ?? 0,
    recentViews: row?.recent_views ?? 0,
    topPages: topPages.rows,
    dailyViews: dailyViews.rows,
  };
}
