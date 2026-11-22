export function slugifyArticleHeading(heading: string): string {
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

export function createArticleHeadingSlugger() {
  const counts = new Map<string, number>();
  const used = new Set<string>();
  return (heading: string) => {
    const base = slugifyArticleHeading(heading);
    let occurrence = (counts.get(base) ?? 0) + 1;
    let id = occurrence === 1 ? base : `${base}-${occurrence}`;
    while (used.has(id)) id = `${base}-${++occurrence}`;
    used.add(id);
    counts.set(base, occurrence);
    return id;
  };
}
