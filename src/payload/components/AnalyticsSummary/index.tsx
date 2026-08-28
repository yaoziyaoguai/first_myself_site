import {
  readAnalyticsSummary,
  startOfShanghaiDayWindow,
} from "@/lib/analytics.server";
import { readAgentOperationsSummary } from
  "@/lib/blog-agent/operationsSummary.server";
import { headers } from "next/headers";
import {
  deriveRequestIdentity,
  formatAnonymousVisitor,
} from "@/lib/requestIdentity";

import "./styles.css";

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} 分 ${remainder} 秒`;
}

async function readCurrentVisitorLabel() {
  try {
    const requestHeaders = new Headers(await headers());
    const request = new Request("https://analytics.invalid", {
      headers: requestHeaders,
    });
    return formatAnonymousVisitor(deriveRequestIdentity(request).fingerprint);
  } catch {
    return null;
  }
}

export async function AnalyticsSummary() {
  // 服务端后台概览必须以每次请求的当前时间计算滚动窗口。
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const until = new Date(now);
  const sevenDaysAgo = startOfShanghaiDayWindow(until);
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const [summary, agentSummary, currentVisitorLabel] = await Promise.all([
    readAnalyticsSummary(sevenDaysAgo, oneDayAgo, until),
    readAgentOperationsSummary(sevenDaysAgo, until),
    readCurrentVisitorLabel(),
  ]);
  const outcomeLabels = {
    answered: "已回答",
    insufficient_evidence: "证据不足",
    rate_limited: "额度限制",
    provider_error: "模型服务异常",
  } as const;
  const maxDailyViews = Math.max(
    1,
    ...summary.dailyViews.map((item) => item.views),
  );

  return (
    <section className="analytics-summary" aria-labelledby="analytics-title">
      <div className="analytics-summary__heading">
        <div>
          <p className="analytics-summary__eyebrow">近 7 天</p>
          <h2 id="analytics-title">访问概览</h2>
        </div>
        <p>
          近 24 小时 {summary.recentViews}{" "}
          次页面浏览。独立访客以 IP 与浏览器信息的服务端哈希估算；有效停留只累计页面可见且浏览器聚焦的时间。已识别的站长浏览器访问不计入概览。
        </p>
      </div>

      <div className="analytics-summary__metrics">
        <div>
          <span>页面浏览量（PV）</span>
          <strong>{summary.views}</strong>
        </div>
        <div>
          <span>独立访客（UV，估算）</span>
          <strong>{summary.visitors}</strong>
        </div>
        <div>
          <span>中位有效停留</span>
          <strong>{formatDuration(summary.medianEngagedSeconds)}</strong>
        </div>
        <div>
          <span>平均阅读深度</span>
          <strong>{summary.averageScrollDepth}%</strong>
        </div>
      </div>

      {currentVisitorLabel && (
        <p className="analytics-summary__current-visitor">
          当前浏览器：{currentVisitorLabel}
        </p>
      )}

      {summary.dailyViews.length > 0 && (
        <div className="analytics-summary__trend">
          <h3>近 7 日趋势</h3>
          <ol>
            {summary.dailyViews.map((item) => (
              <li
                aria-label={`${item.date}：${item.views} PV，${item.visitors} UV`}
                key={item.date}
              >
                <div className="analytics-summary__trend-bar" aria-hidden="true">
                  {item.views > 0 && (
                    <span
                      style={{
                        height: `${Math.max(4, Math.round((item.views / maxDailyViews) * 100))}%`,
                      }}
                    />
                  )}
                </div>
                <strong>{item.date}</strong>
                <small>{item.views} / {item.visitors}</small>
              </li>
            ))}
          </ol>
          <p>页面浏览量（PV）/ 独立访客（UV）</p>
        </div>
      )}

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
          <p>保留脱敏后的问题 30 天，不保存模型答案或对话历史。</p>
        </div>
        <div className="analytics-summary__agent-metrics">
          <div>
            <span>用户提问</span>
            <strong>{agentSummary.questionCount.toLocaleString("zh-CN")}</strong>
          </div>
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
        {agentSummary.recentQuestions.length > 0 && (
          <div className="analytics-summary__agent-inbox">
            <h4>最近问题明细</h4>
            <ol>
              {agentSummary.recentQuestions.map((item, index) => (
                <li key={`${item.createdAt.toISOString()}:${index}`}>
                  <div>
                    <span>{item.questionText}</span>
                    <small>
                      <a
                        href={`/blog/${encodeURIComponent(item.articleSlug)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.articleSlug}
                      </a>{" "}
                      · {outcomeLabels[item.outcome]} · {" "}
                      {item.createdAt.toLocaleString("zh-CN", {
                        hour12: false,
                        timeZone: "Asia/Shanghai",
                      })}
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
