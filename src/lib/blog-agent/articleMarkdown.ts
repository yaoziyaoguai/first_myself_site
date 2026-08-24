import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import type { ArticleChunkSourceKind } from "./articleIndexRepository";

export type ArticleSection = {
  id: string;
  heading: string;
  headingPath: string[];
  anchor: string;
  ordinal: number;
  content: string;
  protectedMaterial?: boolean;
  sourceKind?: ArticleChunkSourceKind;
  sourcePath?: string;
  sourceRepository?: string;
  sourceCommit?: string;
  sourceLineStart?: number;
  sourceLineEnd?: number;
};

export type ParsedArticleMarkdown = {
  sections: ArticleSection[];
};

export type ArticleEvidence = {
  title: string;
  excerpt: string;
  outline: Array<{
    id: string;
    headingPath: string[];
    anchor: string;
  }>;
  sections: ArticleSection[];
  totalCharacters: number;
};

const DEFAULT_MAX_CHARACTERS = 14_000;
const DEFAULT_MAX_SECTIONS = 5;

function normalizeHeading(heading: string): string {
  return heading
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[`*_~[\](){}<>]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "section";
}

export function slugifyArticleHeading(
  heading: string,
  occurrence = 1,
): string {
  const base = normalizeHeading(heading);
  return occurrence > 1 ? `${base}-${occurrence}` : base;
}

function sectionId(ordinal: number, anchor: string): string {
  return `section:${ordinal}:${anchor}`;
}

export function parseArticleMarkdown(markdown: string): ParsedArticleMarkdown {
  const source = markdown.replace(/\r\n?/g, "\n");
  const tree = fromMarkdown(source);
  const sections: ArticleSection[] = [];
  const headingPath: string[] = [];
  const anchorCounts = new Map<string, number>();
  let currentHeading = "文章开头";
  let currentPath: string[] = [];
  let currentAnchor = "top";
  let contentStart = 0;
  let hasRealHeading = false;

  const flush = (contentEnd: number) => {
    const content = source.slice(contentStart, contentEnd).trim();
    if (!content) return;
    const ordinal = sections.length;
    sections.push({
      id: sectionId(ordinal, currentAnchor),
      heading: currentHeading,
      headingPath: [...currentPath],
      anchor: currentAnchor,
      ordinal,
      content,
      sourceKind: "article",
    });
  };

  for (const node of tree.children) {
    if (node.type !== "heading") continue;
    const headingStart = node.position?.start.offset;
    const headingEnd = node.position?.end.offset;
    if (headingStart === undefined || headingEnd === undefined) continue;

    flush(headingStart);
    hasRealHeading = true;
    const level = node.depth;
    const heading = toString(node, {
      includeHtml: false,
      includeImageAlt: false,
    }).trim();
    headingPath.length = level - 1;
    headingPath[level - 1] = heading;
    currentHeading = heading;
    currentPath = headingPath.filter(Boolean);
    const baseAnchor = normalizeHeading(heading);
    const occurrence = (anchorCounts.get(baseAnchor) ?? 0) + 1;
    anchorCounts.set(baseAnchor, occurrence);
    currentAnchor = slugifyArticleHeading(heading, occurrence);
    contentStart = headingEnd;
  }

  flush(source.length);

  if (!hasRealHeading && sections.length === 1) {
    sections[0] = {
      ...sections[0],
      heading: "文章开头",
      headingPath: [],
      anchor: "top",
      id: sectionId(0, "top"),
    };
  }

  return { sections };
}

export function articleQueryTerms(value: string): string[] {
  const normalized = value.normalize("NFKC").toLocaleLowerCase();
  const terms = new Set(
    normalized.match(/[a-z0-9][a-z0-9_.:+/-]*/g) ?? [],
  );
  for (const sequence of normalized.match(/[\p{Script=Han}]+/gu) ?? []) {
    if (sequence.length === 1) terms.add(sequence);
    for (let index = 0; index < sequence.length - 1; index += 1) {
      terms.add(sequence.slice(index, index + 2));
    }
  }
  return [...terms].filter((term) => term.length > 0);
}

function relevance(section: ArticleSection, terms: string[]): number {
  const heading = section.heading.normalize("NFKC").toLocaleLowerCase();
  const content = section.content.normalize("NFKC").toLocaleLowerCase();
  return terms.reduce((score, term) => {
    const headingScore = heading.includes(term) ? 4 : 0;
    const contentScore = content.includes(term) ? 1 : 0;
    return score + headingScore + contentScore;
  }, 0);
}

function truncateAtParagraph(content: string, maximum: number): string {
  if (content.length <= maximum) return content;
  if (maximum <= 0) return "";
  const candidate = content.slice(0, maximum);
  const paragraphEnd = candidate.lastIndexOf("\n\n");
  if (paragraphEnd >= Math.floor(maximum * 0.5)) {
    return candidate.slice(0, paragraphEnd).trimEnd();
  }
  return candidate.trimEnd();
}

function withinBudget(
  sections: ArticleSection[],
  maximumCharacters: number,
): ArticleSection[] {
  const total = sections.reduce(
    (sum, section) => sum + section.content.length,
    0,
  );
  if (total <= maximumCharacters) return sections;

  const allocations = sections.map(() => 0);
  let active = sections.map((_, index) => index);
  let remaining = maximumCharacters;
  while (remaining > 0 && active.length > 0) {
    const fairShare = Math.floor(remaining / active.length);
    const fitting = active.filter(
      (index) => sections[index].content.length <= fairShare,
    );
    if (fitting.length > 0) {
      const fittingSet = new Set(fitting);
      for (const index of fitting) {
        allocations[index] = sections[index].content.length;
        remaining -= allocations[index];
      }
      active = active.filter((index) => !fittingSet.has(index));
      continue;
    }

    const remainder = remaining % active.length;
    for (const [offset, index] of active.entries()) {
      allocations[index] = fairShare + (offset < remainder ? 1 : 0);
    }
    remaining = 0;
  }

  return sections.flatMap((section, index) => {
    const content = truncateAtParagraph(section.content, allocations[index]);
    return content ? [{ ...section, content }] : [];
  });
}

function selectRelevantSections(
  sections: ArticleSection[],
  terms: string[],
  maximumSections: number,
): ArticleSection[] {
  const ranked = sections
    .map((section) => ({ section, score: relevance(section, terms) }))
    .sort(
      (left, right) =>
        right.score - left.score || left.section.ordinal - right.section.ordinal,
    );
  const matching = ranked.filter(({ score }) => score > 0);
  if (matching.length === 0) return sections.slice(0, maximumSections);

  const selected = new Set<number>();
  for (const { section } of matching) {
    if (selected.size >= maximumSections) break;
    selected.add(section.ordinal);
  }
  for (let distance = 1; selected.size < maximumSections; distance += 1) {
    let added = false;
    for (const { section } of matching) {
      for (const ordinal of [section.ordinal - distance, section.ordinal + distance]) {
        if (ordinal < 0 || ordinal >= sections.length || selected.has(ordinal)) {
          continue;
        }
        selected.add(ordinal);
        added = true;
        if (selected.size >= maximumSections) break;
      }
      if (selected.size >= maximumSections) break;
    }
    if (!added && distance >= sections.length) break;
  }

  return [...selected]
    .sort((left, right) => left - right)
    .map((ordinal) => sections[ordinal]);
}

export function buildArticleEvidence(input: {
  title: string;
  excerpt: string;
  markdown: string;
  question: string;
  maxCharacters?: number;
  maxSections?: number;
}): ArticleEvidence {
  const parsed = parseArticleMarkdown(input.markdown);
  const maximumCharacters = Math.max(
    1,
    Math.trunc(input.maxCharacters ?? DEFAULT_MAX_CHARACTERS),
  );
  const maximumSections = Math.max(
    1,
    Math.trunc(input.maxSections ?? DEFAULT_MAX_SECTIONS),
  );
  const outline = parsed.sections.map(({ id, headingPath, anchor }) => ({
    id,
    headingPath,
    anchor,
  }));

  if (parsed.sections.length === 0) {
    return {
      title: input.title,
      excerpt: input.excerpt,
      outline,
      sections: [],
      totalCharacters: 0,
    };
  }

  const totalCharacters = parsed.sections.reduce(
    (total, section) => total + section.content.length,
    0,
  );
  let candidates: ArticleSection[];
  if (
    parsed.sections.length <= maximumSections &&
    totalCharacters <= maximumCharacters
  ) {
    candidates = parsed.sections;
  } else {
    const terms = articleQueryTerms(input.question);
    candidates = selectRelevantSections(
      parsed.sections,
      terms,
      maximumSections,
    );
  }

  const sections = withinBudget(candidates, maximumCharacters);
  return {
    title: input.title,
    excerpt: input.excerpt,
    outline,
    sections,
    totalCharacters: sections.reduce(
      (total, section) => total + section.content.length,
      0,
    ),
  };
}
