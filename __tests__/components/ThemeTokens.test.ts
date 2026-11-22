import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("defines the source values and Tailwind mappings used by reader controls", () => {
  const css = readFileSync("app/theme.css", "utf8");
  const theme = css.match(/@theme inline\s*\{([^}]+)\}/)?.[1];
  const root = css.match(/:root\s*\{([^}]+)\}/)?.[1];
  for (const color of ["destructive", "destructive-foreground", "success", "warning"]) {
    expect(root).toContain(`--${color}:`);
    expect(theme).toContain(`--color-${color}: var(--${color})`);
  }
  expect(root).toContain("--radius:");
  for (const size of ["sm", "md", "lg"]) {
    expect(theme).toMatch(new RegExp(`--radius-${size}:.*var\\(--radius\\)`));
  }
});
