import type { Element, Root } from "hast";
import { bundledLanguages, createHighlighter, type BundledLanguage } from "shiki";
import { decorateArticleStructure, type ArticleCover } from "./articleStructure";

const themes = { light: "one-light", dark: "tokyo-night" } as const;
let highlighter: ReturnType<typeof createHighlighter> | undefined;

export async function prepareArticlePresentation(tree: Root, cover?: ArticleCover) {
  const fences = decorateArticleStructure(tree, cover).filter(
    (fence): fence is typeof fence & { language: BundledLanguage } =>
      Object.hasOwn(bundledLanguages, fence.language),
  );
  if (fences.length === 0) return;

  if (highlighter === undefined) {
    highlighter = createHighlighter({
      themes: Object.values(themes),
      langs: ["sql", "typescript", "tsx", "python", "bash", "json"],
    }).catch((error: unknown) => {
      highlighter = undefined;
      throw error;
    });
  }
  const engine = await highlighter;
  await engine.loadLanguage(...new Set(fences.map(({ language }) => language)));
  for (const { code, source, language } of fences) {
    const result = engine.codeToHast(source, { lang: language, themes, defaultColor: false });
    const pre = result.children[0] as Element;
    code.children = (pre.children[0] as Element).children;
    code.properties.className = ["shiki-code"];
  }
}
