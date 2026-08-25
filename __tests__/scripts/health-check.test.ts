import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(
  resolve(process.cwd(), "scripts/health-check.sh"),
  "utf8",
);

describe("production TLS health check", () => {
  it("uses a validated configurable 21-day renewal window", () => {
    expect(script).toContain(
      'TLS_MIN_VALID_DAYS="${TLS_MIN_VALID_DAYS:-21}"',
    );
    expect(script).toContain(
      '[[ ! "$TLS_MIN_VALID_DAYS" =~ ^[1-9][0-9]*$ ]]',
    );
    expect(script).toContain(
      "tls_check_seconds=$((TLS_MIN_VALID_DAYS * 86400))",
    );
    expect(script).toContain(
      "openssl x509 -checkend \"$tls_check_seconds\" -noout",
    );
    expect(script).toContain("expires within $TLS_MIN_VALID_DAYS days");
  });
});
