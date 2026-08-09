export function hasMeaningfulContent(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

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

export function resolveRecord<T extends Record<string, unknown>>(
  value: Partial<T> | null | undefined,
  fallback: T,
): T {
  const resolved = { ...fallback };

  for (const key of Object.keys(fallback) as (keyof T)[]) {
    if (hasMeaningfulContent(value?.[key])) {
      resolved[key] = value?.[key] as T[keyof T];
    }
  }

  return resolved;
}
