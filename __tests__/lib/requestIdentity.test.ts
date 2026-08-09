import { describe, expect, it } from "vitest";
import { deriveRequestIdentity } from "@/lib/requestIdentity";

describe("deriveRequestIdentity", () => {
  it("derives stable opaque identifiers from server request context", () => {
    const request = new Request("https://example.com/api/likes", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.2",
        "user-agent": "Test Browser",
      },
    });

    const first = deriveRequestIdentity(request, "test-secret");
    const second = deriveRequestIdentity(request, "test-secret");

    expect(first).toEqual(second);
    expect(first.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(first)).not.toContain("203.0.113.10");
    expect(JSON.stringify(first)).not.toContain("Test Browser");
  });

  it("changes identifiers when the secret changes", () => {
    const request = new Request("https://example.com", {
      headers: { "x-real-ip": "203.0.113.10", "user-agent": "Browser" },
    });

    expect(deriveRequestIdentity(request, "secret-a")).not.toEqual(
      deriveRequestIdentity(request, "secret-b"),
    );
  });

  it("fails closed when no server secret is configured", () => {
    const request = new Request("https://example.com");
    expect(() => deriveRequestIdentity(request, "")).toThrow(
      "PAYLOAD_SECRET",
    );
  });
});
