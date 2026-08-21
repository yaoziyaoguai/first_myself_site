export type ArticleSection = {
  id: string;
  heading: string;
  headingPath: string[];
  anchor: string;
  ordinal: number;
  content: string;
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

function hasContent(lines: string[]): boolean {
  return lines.some((line) => line.trim().length > 0);
}

export function parseArticleMarkdown(markdown: string): ParsedArticleMarkdown {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const sections: ArticleSection[] = [];
  const headingPath: string[] = [];
  const anchorCounts = new Map<string, number>();
  let currentHeading = "文章开头";
  let currentPath: string[] = [];
  let currentAnchor = "top";
  let currentLines: string[] = [];
  let hasRealHeading = false;
  let fence: { character: "`" | "~"; length: number } | null = null;

  const flush = () => {
    if (!hasContent(currentLines)) {
      currentLines = [];
      return;
    }
    const ordinal = sections.length;
    sections.push({
      id: sectionId(ordinal, currentAnchor),
      heading: currentHeading,
      headingPath: [...currentPath],
      anchor: currentAnchor,
      ordinal,
      content: currentLines.join("\n").trim(),
    });
    currentLines = [];
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      const character = marker[0] as "`" | "~";
      if (!fence) {
        fence = { character, length: marker.length };
      } else if (fence.character === character && marker.length >= fence.length) {
        fence = null;
      }
      currentLines.push(line);
      continue;
    }

    const headingMatch = !fence
      ? line.match(/^ {0,3}(#{1,6})[\t ]+(.+?)[\t ]*#*[\t ]*$/)
      : null;
    if (!headingMatch) {
      currentLines.push(line);
      continue;
    }

    flush();
    hasRealHeading = true;
    const level = headingMatch[1].length;
    const heading = headingMatch[2].trim();
    headingPath.length = level - 1;
    headingPath[level - 1] = heading;
    currentHeading = heading;
    currentPath = headingPath.filter(Boolean);
    const baseAnchor = normalizeHeading(heading);
    const occurrence = (anchorCounts.get(baseAnchor) ?? 0) + 1;
    anchorCounts.set(baseAnchor, occurrence);
    currentAnchor = slugifyArticleHeading(heading, occurrence);
  }

  flush();

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

function queryTerms(value: string): string[] {
  const normalized = value.toLocaleLowerCase();
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
  const heading = section.heading.toLocaleLowerCase();
  const content = section.content.toLocaleLowerCase();
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
  const selected: ArticleSection[] = [];
  let remaining = maximumCharacters;
  for (const [index, section] of sections.entries()) {
    if (remaining <= 0) break;
    const remainingSections = sections.length - index;
    const fairShare = Math.max(1, Math.floor(remaining / remainingSections));
    const content = truncateAtParagraph(section.content, fairShare);
    if (!content) continue;
    selected.push({ ...section, content });
    remaining -= content.length;
  }
  return selected;
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
    const terms = queryTerms(input.question);
    candidates = [...parsed.sections]
      .sort(
        (left, right) =>
          relevance(right, terms) - relevance(left, terms) ||
          left.ordinal - right.ordinal,
      )
      .slice(0, maximumSections)
      .sort((left, right) => left.ordinal - right.ordinal);
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
