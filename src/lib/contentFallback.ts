export function resolveText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : fallback;
}

export function resolveArray<T>(value: unknown, fallback: readonly T[]): T[] {
  return Array.isArray(value) && value.length > 0
    ? (value as T[])
    : [...fallback];
}
