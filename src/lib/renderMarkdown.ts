import type { Root as HtmlRoot } from "hast";
import type { Heading, Root } from "mdast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { toString } from "mdast-util-to-string";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { createArticleHeadingSlugger } from "@/lib/articleHeadings";
import { INTERACTIVE_EMBED_PREFIX, remarkInteractiveHtml } from "@/lib/interactive-html/ast";

function normalizeTitle(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/[\p{P}\p{S}\s]+/gu, "");
}

export function remarkArticleHeadings(title?: string) {
  return (tree: Root) => {
    const idFor = createArticleHeadingSlugger();
    let first = true;
    function assign(node: Heading) {
      const text = toString(node, { includeHtml: false, includeImageAlt: false });
      const id = idFor(text);
      node.data = { hProperties: { id, tabIndex: -1 } };
      if (node.depth === 1 && title) {
        if (first && normalizeTitle(text) === normalizeTitle(title)) {
          node.children = [];
          node.data = { hName: "span", hProperties: { id, ariaHidden: "true" } };
        } else {
          node.depth = 2;
        }
      }
      first = false;
    }

    // 正文的顶层标题与 Agent 引用使用同一套编号。
    for (const node of tree.children) {
      if (node.type === "heading") assign(node);
    }
    visit(tree, "heading", (node, _index, parent) => {
      if (parent !== tree) assign(node);
    });
  };
}

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkInteractiveHtml);

export function parseMarkdown(markdown: string, title?: string): HtmlRoot {
  const processor = markdownProcessor()
    .use(remarkArticleHeadings, title)
    .use(remarkRehype, { allowDangerousHtml: true });
  const tree = processor.runSync(processor.parse(markdown));

  visit(tree, (node, index, parent) => {
    // 保留 Markdown 原有的原始 HTML 文本和链接协议过滤。
    if (node.type === "raw" && parent && index !== undefined) {
      parent.children[index] = { type: "text", value: node.value };
    } else if (node.type === "element") {
      if (node.tagName === "a" && typeof node.properties.href === "string") {
        node.properties.href = defaultUrlTransform(node.properties.href);
      }
      if (node.tagName === "img" && typeof node.properties.src === "string") {
        node.properties.src = defaultUrlTransform(node.properties.src);
      }
    }
  });
  return tree;
}

export function renderMarkdown(
  tree: HtmlRoot,
  components: Components,
  embed: (props: Record<string, unknown>) => React.ReactNode,
) {
  const embeds = tree.children.flatMap((node) =>
    node.type === "element" && node.tagName.startsWith(INTERACTIVE_EMBED_PREFIX)
      ? [[node.tagName, embed] as const]
      : [],
  );
  return toJsxRuntime(tree, {
    Fragment,
    jsx,
    jsxs,
    passKeys: true,
    passNode: true,
    components: { ...components, ...Object.fromEntries(embeds) },
  });
}
