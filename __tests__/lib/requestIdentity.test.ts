import { describe, expect, it } from "vitest";
import {
  deriveRequestIdentity,
  maskNetworkPrefix,
} from "@/lib/requestIdentity";

describe("maskNetworkPrefix", () => {
  it.each([
    ["182.92.85.15", "182.92.85.*"],
    ["0.0.0.0", "0.0.0.*"],
    ["2001:0DB8:0000:0001:2222:3333:4444:5555", "2001:db8:0:1::/64"],
    ["2001:db8::abcd", "2001:db8:0:0::/64"],
    ["::ffff:192.0.2.128", "192.0.2.*"],
  ])("masks %s without preserving its host address", (address, expected) => {
    const result = maskNetworkPrefix(address);

    expect(result).toBe(expected);
    expect(result).not.toBe(address);
  });

  it.each([
    "unknown",
    "1.2.3.999",
    "[2001:db8::1]:443",
    "fe80::1%en0",
    "",
  ])("returns no display value for invalid address %s", (address) => {
    expect(maskNetworkPrefix(address)).toBe("");
  });

  it("derives the prefix from the same trusted address as anonymous hashes", () => {
    const identity = deriveRequestIdentity(
      new Request("https://example.com", {
        headers: {
          "x-real-ip": "203.0.113.42",
          "x-forwarded-for": "198.51.100.99",
          "user-agent": "test-browser",
        },
      }),
      "test-secret-that-is-long-enough",
    );

    expect(identity.networkPrefix).toBe("203.0.113.*");
    expect(identity.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.rateLimitKey).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(identity)).not.toContain("203.0.113.42");
  });
});
