import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugifyArticleHeading } from "@/lib/blog-agent/articleMarkdown";

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(textFromChildren).join("");
  }
  if (children && typeof children === "object" && "props" in children) {
    return textFromChildren(
      (children as { props?: { children?: ReactNode } }).props?.children,
    );
  }
  return "";
}

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
type HeadingProps = ComponentPropsWithoutRef<HeadingTag> & { node?: unknown };

function headingComponent(
  Tag: HeadingTag,
  counts: Map<string, number>,
) {
  return function ArticleHeading({ children, node, ...props }: HeadingProps) {
    void node;
    const heading = textFromChildren(children);
    const base = slugifyArticleHeading(heading);
    const occurrence = (counts.get(base) ?? 0) + 1;
    counts.set(base, occurrence);
    return (
      <Tag {...props} id={slugifyArticleHeading(heading, occurrence)}>
        {children}
      </Tag>
    );
  };
}

export function MarkdownArticle({ markdown }: { markdown: string }) {
  const counts = new Map<string, number>();
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: headingComponent("h1", counts),
        h2: headingComponent("h2", counts),
        h3: headingComponent("h3", counts),
        h4: headingComponent("h4", counts),
        h5: headingComponent("h5", counts),
        h6: headingComponent("h6", counts),
      }}
    >
      {markdown}
    </Markdown>
  );
}
