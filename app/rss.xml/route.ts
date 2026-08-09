import { renderRssFeed, type DiscoveryPost } from "@/lib/discovery";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: {
      and: [
        { status: { equals: "published" } },
        { visibility: { equals: "public" } },
      ],
    },
    sort: "-publishedDate",
    limit: 100,
  });

  return new Response(renderRssFeed(result.docs as unknown as DiscoveryPost[]), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
