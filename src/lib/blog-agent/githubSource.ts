export type GitHubSource = {
  repository: string;
  commit: string;
  path: string;
  lineStart: number;
  lineEnd: number;
  url: string;
};

export function canonicalGitHubRepository(value: unknown): string | null {
  if (typeof value !== "string" || value !== value.trim()) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLocaleLowerCase() !== "github.com" ||
    parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash ||
    parts.length !== 2 ||
    !/^[A-Za-z0-9_.-]+$/.test(parts[0]) ||
    !/^[A-Za-z0-9_.-]+$/.test(parts[1]) ||
    parts[1].endsWith(".git")
  ) {
    return null;
  }
  const canonical = `https://github.com/${parts[0]}/${parts[1]}`;
  return value === canonical ? canonical : null;
}

export function buildGitHubSource(value: unknown): GitHubSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const repository = canonicalGitHubRepository(item.repository);
  if (
    !repository ||
    typeof item.commit !== "string" ||
    typeof item.path !== "string" ||
    !Number.isInteger(item.lineStart) ||
    !Number.isInteger(item.lineEnd) ||
    (item.lineStart as number) < 1 ||
    (item.lineEnd as number) < (item.lineStart as number) ||
    !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(item.commit) ||
    item.path.startsWith("/") ||
    item.path.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    return null;
  }
  const encodedPath = item.path.split("/").map(encodeURIComponent).join("/");
  return {
    repository,
    commit: item.commit,
    path: item.path,
    lineStart: item.lineStart as number,
    lineEnd: item.lineEnd as number,
    url: `${repository}/blob/${item.commit}/${encodedPath}` +
      `#L${item.lineStart}-L${item.lineEnd}`,
  };
}
