import type { MetadataRoute } from "next";
import { buildBlogFrontendWhere } from "@/lib/blogVisibility";
import { buildSitemapEntries, type DiscoveryPost } from "@/lib/discovery";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayloadAPI();
  const [result, series] = await Promise.all([
    payload.find({
      collection: "blog",
      where: buildBlogFrontendWhere(null),
      sort: "-publishedDate",
      limit: 1000,
      depth: 0,
      select: {
        slug: true,
        publishedDate: true,
        updatedAt: true,
        status: true,
        visibility: true,
      },
    }),
    payload.find({
      collection: "blog-series",
      where: { status: { equals: "published" } },
      sort: "sortOrder",
      limit: 100,
      depth: 0,
      select: {
        slug: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);

  return buildSitemapEntries(
    result.docs as unknown as DiscoveryPost[],
    series.docs,
  );
}
