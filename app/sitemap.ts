import type { MetadataRoute } from "next";
import { buildBlogFrontendWhere } from "@/lib/blogVisibility";
import { buildSitemapEntries, type DiscoveryPost } from "@/lib/discovery";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: buildBlogFrontendWhere(null),
    sort: "-publishedDate",
    limit: 1000,
    depth: 0,
    select: {
      slug: true,
      publishedDate: true,
      status: true,
      visibility: true,
    },
  });

  return buildSitemapEntries(result.docs as unknown as DiscoveryPost[]);
}
