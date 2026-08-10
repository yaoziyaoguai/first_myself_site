import { readAnalyticsSummary } from "@/lib/analytics.server";

import "./styles.css";

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} 分 ${remainder} 秒`;
}

export async function AnalyticsSummary() {
  // 服务端后台概览必须以每次请求的当前时间计算滚动窗口。
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const summary = await readAnalyticsSummary(sevenDaysAgo, oneDayAgo);

  return (
    <section className="analytics-summary" aria-labelledby="analytics-title">
      <div className="analytics-summary__heading">
        <div>
          <p className="analytics-summary__eyebrow">近 7 天</p>
          <h2 id="analytics-title">访问概览</h2>
        </div>
        <p>
          近 24 小时 {summary.recentViews}{" "}
          次访问。有效停留只累计页面可见时间，访客数按服务端匿名哈希估算。
        </p>
      </div>

      <div className="analytics-summary__metrics">
        <div>
          <span>访问次数</span>
          <strong>{summary.views}</strong>
        </div>
        <div>
          <span>独立访客（估算）</span>
          <strong>{summary.visitors}</strong>
        </div>
        <div>
          <span>平均有效停留</span>
          <strong>{formatDuration(summary.averageEngagedSeconds)}</strong>
        </div>
        <div>
          <span>平均阅读深度</span>
          <strong>{summary.averageScrollDepth}%</strong>
        </div>
      </div>

      {summary.topPages.length > 0 && (
        <div className="analytics-summary__pages">
          <h3>访问最多的页面</h3>
          <ol>
            {summary.topPages.map((page) => (
              <li key={page.path}>
                <a href={page.path} target="_blank" rel="noreferrer">
                  <span>{page.title}</span>
                  <small>{page.path}</small>
                </a>
                <strong>{page.views}</strong>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
