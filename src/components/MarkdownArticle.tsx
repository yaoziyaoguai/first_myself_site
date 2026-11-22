import type { Components } from "react-markdown";
import { ArticleCodeBlock, ArticleTable } from "@/components/ArticleBlocks";
import { ArticleImage } from "@/components/ArticleImage";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { HeadingLink } from "@/components/HeadingLink";
import { InteractiveHtmlEmbed } from "@/components/InteractiveHtmlEmbed";
import { prepareArticlePresentation } from "@/lib/articlePresentation";
import type { ArticleCover } from "@/lib/articleStructure";
import { INTERACTIVE_EMBED_PREFIX, markerFromElementProps } from "@/lib/interactive-html/ast";
import { parseMarkdown, renderMarkdown } from "@/lib/renderMarkdown";

const components = {
  h2: ({ node, id, ...props }) => {
    void node;
    return (
      <div className="article-heading">
        <h2 {...props} id={id} />
        <HeadingLink id={id!} />
      </div>
    );
  },
  pre: ({ children, node }) => <ArticleCodeBlock node={node!} action={<CopyCodeButton />}>{children}</ArticleCodeBlock>,
  table: ({ children }) => <ArticleTable>{children}</ArticleTable>,
  "article-image": ({ node, ...props }) => {
    void node;
    return <ArticleImage {...props} />;
  },
} satisfies Components & { "article-image": Components["img"] };

function ArticleInteractiveHtmlEmbed(props: Record<string, unknown>) {
  return (
    <InteractiveHtmlEmbed
      marker={markerFromElementProps(props)}
      blogId={props["data-blog-id"] as string | number | null | undefined}
      mode={props["data-interactive-mode"] as "view" | "preview"}
    />
  );
}

export async function MarkdownArticle({
  markdown,
  title,
  cover,
  blogId,
  interactiveMode = "view",
}: {
  markdown: string;
  title?: string;
  cover?: ArticleCover;
  blogId?: string | number | null;
  interactiveMode?: "view" | "preview";
}) {
  const tree = parseMarkdown(markdown, title);
  await prepareArticlePresentation(tree, cover);
  for (const node of tree.children) {
    if (node.type === "element" && node.tagName.startsWith(INTERACTIVE_EMBED_PREFIX)) {
      node.properties["data-blog-id"] = blogId;
      node.properties["data-interactive-mode"] = interactiveMode;
    }
  }
  return renderMarkdown(tree, components, ArticleInteractiveHtmlEmbed);
}
