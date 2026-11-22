import type { Element, Root, Text } from "hast";
import { bundledLanguages, createHighlighter, type BundledLanguage } from "shiki";
import { visit } from "unist-util-visit";

const themes = { light: "github-light-default", dark: "vesper" } as const;
let highlighter: ReturnType<typeof createHighlighter> | undefined;

export type ArticleCover = { url: string; width?: number; height?: number };

export async function prepareArticlePresentation(tree: Root, cover?: ArticleCover) {
  let firstImage = true;
  const fences: { code: Element; source: string; lang: BundledLanguage }[] = [];
  visit(tree, "element", (node) => {
    if (node.tagName === "img") {
      node.properties.loading = firstImage ? "eager" : "lazy";
      node.properties.decoding = "async";
      if (cover && cover.url === node.properties.src) {
        node.properties.width = cover.width;
        node.properties.height = cover.height;
      }
      firstImage = false;
      return;
    }
    if (node.tagName !== "pre") return;
    // remark-rehype 始终为代码块生成 pre > code > text，空围栏的文本值为空字符串。
    const code = node.children[0] as Element;
    const source = (code.children[0] as Text).value;

    const languageClass = (code.properties.className as string[] | undefined)
      ?.find((name) => name.startsWith("language-"));
    const language = languageClass?.slice("language-".length) ?? "text";
    node.properties["data-language"] = language.toUpperCase();
    node.properties["data-lines"] = source.replace(/\n$/, "").split("\n").length;

    const lang = language.toLowerCase();
    if (Object.hasOwn(bundledLanguages, lang)) {
      fences.push({ code, source, lang: lang as BundledLanguage });
    }
  });

  // 空白节点保留在普通段落之间，图注只消费与图片紧邻的段落。
  const children = tree.children;
  for (let index = 0; index < children.length; index++) {
    const paragraph = children[index];
    if (paragraph.type !== "element" || paragraph.tagName !== "p" || paragraph.children.length !== 1) continue;
    const image = paragraph.children[0];
    if (image.type !== "element" || image.tagName !== "img") continue;

    const captionIndex = children[index + 1]?.type === "text" ? index + 2 : index + 1;
    const next = children[captionIndex];
    const leading = next?.type === "element" ? next.children[0] : undefined;
    const captionText = leading?.type === "element" ? leading.children[0] : leading;
    const isCaption = next?.type === "element" && next.tagName === "p" && captionText?.type === "text" &&
      /^(?:图\s*\d+|Figure\s+\d+)[：:.\s]/i.test(captionText.value);
    const alt = String(image.properties.alt ?? "").trim();
    const content: Element["children"] = [{ ...image, tagName: "article-image" }];
    if (isCaption) {
      content.push({ ...next, tagName: "figcaption" });
      children.splice(index + 1, captionIndex - index);
    } else if (alt) {
      content.push({ type: "element", tagName: "figcaption", properties: {}, children: [{ type: "text", value: alt }] });
    }
    children[index] = {
      ...paragraph,
      tagName: "figure",
      properties: { className: ["article-figure"] },
      children: content,
    };
  }

  if (fences.length > 0) {
    highlighter ??= createHighlighter({ themes: Object.values(themes), langs: [] });
    const engine = await highlighter;
    await engine.loadLanguage(...new Set(fences.map(({ lang }) => lang)));
    for (const { code, source, lang } of fences) {
      const result = engine.codeToHast(source, { lang, themes, defaultColor: false });
      const pre = result.children[0] as Element;
      code.children = (pre.children[0] as Element).children;
      code.properties.className = ["shiki-code"];
    }
  }
}
