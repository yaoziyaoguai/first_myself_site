import { useMemo, type ComponentPropsWithoutRef, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugifyArticleHeading } from "@/lib/blog-agent/articleMarkdown";
import { InteractiveHtmlEmbed } from "@/components/InteractiveHtmlEmbed";
import {
  INTERACTIVE_EMBED_PREFIX,
  interactiveMarkerIndex,
  markerFromElementProps,
} from "@/lib/interactive-html/ast";

function normalizeTitle(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
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

function headingComponent(Tag: HeadingTag, state: HeadingState) {
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
    const RenderTag: HeadingTag = Tag === "h1" && state.title ? "h2" : Tag;
    return (
      <RenderTag {...props} id={id} tabIndex={-1}>
        {children}
      </RenderTag>
    );
  };
}

export function MarkdownArticle({
  markdown,
  title,
  blogId,
  interactiveMode = "view",
}: {
  markdown: string;
  title?: string;
  /** 当前文章 ID；互动块读取绑定到它，缺失时块只显示说明。 */
  blogId?: string | number | null;
  interactiveMode?: "view" | "preview";
}) {
  const headingState = useMemo<HeadingState>(
    () => ({
      counts: new Map<string, number>(),
      seenHeading: false,
      title,
    }),
    [title],
  );
  // 整篇只解析一次：互动块不能按 marker 切成多个 ReactMarkdown，
  // 否则会破坏跨段引用链接与标题编号。
  const { plugin, rehypePlugin } = useMemo(
    () => interactiveMarkerIndex(markdown),
    [markdown],
  );
  const embedComponent = useMemo(() => {
    function ArticleInteractiveHtmlEmbed(props: Record<string, unknown>) {
      const marker = markerFromElementProps(props);
      if (!marker) return null;
      return (
        <InteractiveHtmlEmbed
          marker={marker}
          blogId={blogId}
          mode={interactiveMode}
        />
      );
    }
    return ArticleInteractiveHtmlEmbed;
  }, [blogId, interactiveMode]);
  const components = useMemo<Components>(() => {
    const embedComponents: Record<
      string,
      (props: Record<string, unknown>) => ReactNode
    > = {};
    for (const tag of Object.keys(componentsWithEmbeds(markdown))) {
      embedComponents[tag] = embedComponent;
    }
    return {
      h1: headingComponent("h1", headingState),
      h2: headingComponent("h2", headingState),
      h3: headingComponent("h3", headingState),
      h4: headingComponent("h4", headingState),
      h5: headingComponent("h5", headingState),
      h6: headingComponent("h6", headingState),
      pre: ({ children }) => (
        <pre tabIndex={0} role="region" aria-label="可横向滚动的代码">
          {children}
        </pre>
      ),
      table: ({ children }) => (
        <div
          aria-label="可横向滚动的表格"
          className="article-table-scroll"
          role="region"
          tabIndex={0}
        >
          <table>{children}</table>
        </div>
      ),
      ...embedComponents,
    } as Components;
  }, [embedComponent, headingState, markdown]);

  return (
    <Markdown
      remarkPlugins={[remarkGfm, ...plugin]}
      rehypePlugins={rehypePlugin}
      components={components}
    >
      {markdown}
    </Markdown>
  );
}

function componentsWithEmbeds(markdown: string): Record<string, true> {
  const result: Record<string, true> = {};
  for (const entry of interactiveMarkerIndex(markdown).markers.values()) {
    result[`${INTERACTIVE_EMBED_PREFIX}${entry.id}`] = true;
  }
  return result;
}
