import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugifyArticleHeading } from "@/lib/blog-agent/articleMarkdown";

function normalizeTitle(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

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
type HeadingState = {
  counts: Map<string, number>;
  seenHeading: boolean;
  title?: string;
};

function headingComponent(
  Tag: HeadingTag,
  state: HeadingState,
) {
  return function ArticleHeading({ children, node, ...props }: HeadingProps) {
    void node;
    const heading = textFromChildren(children);
    const base = slugifyArticleHeading(heading);
    const occurrence = (state.counts.get(base) ?? 0) + 1;
    state.counts.set(base, occurrence);
    const id = slugifyArticleHeading(heading, occurrence);
    const isFirstHeading = !state.seenHeading;
    state.seenHeading = true;
    if (
      isFirstHeading &&
      Tag === "h1" &&
      state.title &&
      normalizeTitle(heading) === normalizeTitle(state.title)
    ) {
      return <span id={id} aria-hidden="true" />;
    }
    return (
      <Tag {...props} id={id}>
        {children}
      </Tag>
    );
  };
}

export function MarkdownArticle({
  markdown,
  title,
}: {
  markdown: string;
  title?: string;
}) {
  const headingState: HeadingState = {
    counts: new Map<string, number>(),
    seenHeading: false,
    title,
  };
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: headingComponent("h1", headingState),
        h2: headingComponent("h2", headingState),
        h3: headingComponent("h3", headingState),
        h4: headingComponent("h4", headingState),
        h5: headingComponent("h5", headingState),
        h6: headingComponent("h6", headingState),
      }}
    >
      {markdown}
    </Markdown>
  );
}
