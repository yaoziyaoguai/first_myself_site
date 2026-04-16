import { describe, it, expect, vi } from "vitest";
import { GET } from "@/app/api/ip/route";
import { NextRequest } from "next/server";

describe("/api/ip", () => {
  const createMockRequest = (headers: Record<string, string> = {}): NextRequest => {
    return {
      headers: {
        get: (key: string) => headers[key] || null,
      },
    } as unknown as NextRequest;
  };

  it("should return IP from x-forwarded-for header", async () => {
    const request = createMockRequest({
      "x-forwarded-for": "192.168.1.1, 10.0.0.1",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.ip).toBe("192.168.1.1");
  });

  it("should return IP from x-real-ip header when x-forwarded-for is not present", async () => {
    const request = createMockRequest({
      "x-real-ip": "10.0.0.2",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.ip).toBe("10.0.0.2");
  });

  it("should return 127.0.0.1 when no IP headers are present", async () => {
    const request = createMockRequest({});

    const response = await GET(request);
    const data = await response.json();

    expect(data.ip).toBe("127.0.0.1");
  });

  it("should prioritize x-forwarded-for over x-real-ip", async () => {
    const request = createMockRequest({
      "x-forwarded-for": "192.168.1.100",
      "x-real-ip": "10.0.0.5",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.ip).toBe("192.168.1.100");
  });

  it("should trim whitespace from x-forwarded-for IP", async () => {
    const request = createMockRequest({
      "x-forwarded-for": "  192.168.1.50  ",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.ip).toBe("192.168.1.50");
  });
});
