import type { MetadataRoute } from "next";
import { buildSitemapEntries, type DiscoveryPost } from "@/lib/discovery";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    limit: 1000,
  });

  return buildSitemapEntries(result.docs as unknown as DiscoveryPost[]);
}
