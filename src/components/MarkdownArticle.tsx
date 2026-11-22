import { useCallback } from "react";
import type { Components } from "react-markdown";
import { ArticleImage } from "@/components/ArticleImage";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { InteractiveHtmlEmbed } from "@/components/InteractiveHtmlEmbed";
import { prepareArticlePresentation, type ArticleCover } from "@/lib/articlePresentation";
import { markerFromElementProps } from "@/lib/interactive-html/ast";
import { parseMarkdown, renderMarkdown } from "@/lib/renderMarkdown";

const components = {
  pre: ({ children, node }) => {
    const { "data-language": language, "data-lines": lines } = node!.properties;
    return (
      <div className="article-code">
        <div className="article-code-toolbar">
          <span>{language!.toString()}</span>
          <span>{lines!.toString()} 行</span>
          <CopyCodeButton />
        </div>
        <pre tabIndex={0} role="region" aria-label="可横向滚动的代码">
          {children}
        </pre>
      </div>
    );
  },
  table: ({ children }) => (
    <div aria-label="可横向滚动的表格" className="article-table-scroll" role="region" tabIndex={0}>
      <table>{children}</table>
    </div>
  ),
  "article-image": ({ node, ...props }) => {
    void node;
    return <ArticleImage {...props} />;
  },
} satisfies Components & { "article-image": Components["img"] };

export function MarkdownArticle({
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
  const embed = useCallback(function ArticleInteractiveHtmlEmbed(props: Record<string, unknown>) {
    return (
      <InteractiveHtmlEmbed
        marker={markerFromElementProps(props)}
        blogId={blogId}
        mode={interactiveMode}
      />
    );
  }, [blogId, interactiveMode]);
  const tree = parseMarkdown(markdown, title);
  prepareArticlePresentation(tree, cover);
  return renderMarkdown(tree, components, embed);
}
