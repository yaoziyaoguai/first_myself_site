import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  tech: "科技",
  finance: "财经",
  ai: "AI",
  data: "数据工程",
  society: "社会",
  other: "其他",
};

const CATEGORY_COLORS: Record<string, string> = {
  tech: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  finance: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  ai: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  data: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  society: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export default async function TrendingPage() {
  const payload = await getPayloadAPI();

  const result = await payload.find({
    collection: "trending-topics",
    where: {
      status: { equals: "published" },
    },
    sort: "-date",
    limit: 100,
  });

  const topics = result.docs;

  // Group topics by date
  const grouped: Record<string, typeof topics> = {};
  for (const topic of topics) {
    const dateKey = topic.date
      ? new Date(topic.date as string).toISOString().split("T")[0]
      : "未知日期";
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(topic);
  }

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="container mx-auto px-4 py-12">
      <section className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">每日热点趋势</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          持续跟踪科技、AI、数据工程、财经等领域的热点动态，记录值得关注的趋势与事件。
        </p>
      </section>

      {sortedDates.length === 0 ? (
        <p className="text-muted-foreground">暂无热点数据，敬请期待。</p>
      ) : (
        <div className="space-y-10">
          {sortedDates.map((date) => (
            <section key={date}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-semibold">{date}</h2>
                <span className="text-sm text-muted-foreground">
                  {grouped[date].length} 条热点
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {grouped[date]
                  .sort((a, b) => ((b.hotScore as number) || 0) - ((a.hotScore as number) || 0))
                  .map((topic) => {
                    const category = topic.category as string;
                    const tags = (topic.tags as { tag: string }[] | undefined) || [];
                    const colorClass = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;

                    return (
                      <Card key={topic.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base leading-snug">
                              {topic.sourceUrl ? (
                                <a
                                  href={topic.sourceUrl as string}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-primary transition-colors"
                                >
                                  {topic.title}
                                </a>
                              ) : (
                                topic.title
                              )}
                            </CardTitle>
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${colorClass}`}
                            >
                              {CATEGORY_LABELS[category] || "其他"}
                            </span>
                          </div>
                          <CardDescription className="mt-1">
                            {topic.description as string}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {tags.map((t) => (
                              <Badge key={t.tag} variant="outline" className="text-xs">
                                {t.tag}
                              </Badge>
                            ))}
                            {topic.sourceName && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                来源：{topic.sourceName as string}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
