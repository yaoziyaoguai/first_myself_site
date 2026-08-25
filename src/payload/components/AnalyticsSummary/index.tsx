import { readAnalyticsSummary } from "@/lib/analytics.server";
import { readAgentOperationsSummary } from
  "@/lib/blog-agent/operationsSummary.server";

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
  const [summary, agentSummary] = await Promise.all([
    readAnalyticsSummary(sevenDaysAgo, oneDayAgo),
    readAgentOperationsSummary(sevenDaysAgo, new Date(now)),
  ]);
  const reasonLabels = {
    insufficient_evidence: "证据不足",
    rate_limited: "额度限制",
    provider_error: "模型服务异常",
  } as const;

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

      <div className="analytics-summary__agent">
        <div className="analytics-summary__agent-heading">
          <div>
            <p className="analytics-summary__eyebrow">近 7 天</p>
            <h3>文章 Agent</h3>
          </div>
          <p>只保留未回答问题的脱敏摘要，30 天后自动删除。</p>
        </div>
        <div className="analytics-summary__agent-metrics">
          <div>
            <span>模型请求</span>
            <strong>{agentSummary.requestCount.toLocaleString("zh-CN")}</strong>
          </div>
          <div>
            <span>输入 / 输出 token</span>
            <strong>
              {agentSummary.inputTokens.toLocaleString("zh-CN")} / {" "}
              {agentSummary.outputTokens.toLocaleString("zh-CN")}
            </strong>
          </div>
          <div>
            <span>未回答</span>
            <strong>{agentSummary.unansweredCount.toLocaleString("zh-CN")}</strong>
          </div>
        </div>
        {agentSummary.recentUnanswered.length > 0 && (
          <div className="analytics-summary__agent-inbox">
            <h4>最近未回答</h4>
            <ol>
              {agentSummary.recentUnanswered.map((item, index) => (
                <li key={`${item.createdAt.toISOString()}:${index}`}>
                  <div>
                    <span>{item.questionExcerpt}</span>
                    <small>
                      {item.articleSlug} · {reasonLabels[item.reason]} · {" "}
                      {item.createdAt.toLocaleString("zh-CN", { hour12: false })}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
