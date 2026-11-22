import { articleTags } from "@/lib/articleDiscovery";
import { summarizeExcerpt } from "@/lib/discovery";
import { findArticleIndexForViewer } from "@/lib/visitorContentCache";

export async function GET() {
  const { docs } = await findArticleIndexForViewer(null);
  return Response.json(docs.map((post) => ({
    slug: String(post.slug),
    title: String(post.title),
    excerpt: summarizeExcerpt(post.excerpt, 170),
    tags: articleTags(post.tags),
  })));
}
