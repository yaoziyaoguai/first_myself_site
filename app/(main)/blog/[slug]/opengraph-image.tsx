import { createOpenGraphImage } from "@/lib/openGraphImage";
import { formatSiteDate } from "@/lib/siteDate";
import { findBlogPostBySlugForViewer } from "@/lib/visitorContentCache";

export const alt = "精密工程志文章分享图";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function ArticleOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await findBlogPostBySlugForViewer(null, slug);
  if (!article) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

  const date = article.publishedDate ? formatSiteDate(article.publishedDate) : "";
  const detail = [date, article.readingTime].filter(Boolean).join(" · ");
  return createOpenGraphImage(article.title, detail, "public, max-age=0, must-revalidate");
}
