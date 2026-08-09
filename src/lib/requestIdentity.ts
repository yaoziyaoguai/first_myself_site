import { createHmac } from "node:crypto";

export type RequestIdentity = {
  ipHash: string;
  fingerprint: string;
  rateLimitKey: string;
};

function hmac(secret: string, purpose: string, value: string): string {
  return createHmac("sha256", secret)
    .update(`${purpose}\0${value}`)
    .digest("hex");
}

function readClientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return (forwarded || realIp || "unknown").slice(0, 128);
}

export function deriveRequestIdentity(
  request: Request,
  secret = process.env.PAYLOAD_SECRET ?? "",
): RequestIdentity {
  if (!secret) {
    throw new Error("PAYLOAD_SECRET is required to derive request identity");
  }

  const address = readClientAddress(request);
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, 512);

  return {
    ipHash: hmac(secret, "interaction-ip", address),
    fingerprint: hmac(secret, "interaction-client", `${address}\0${userAgent}`),
    rateLimitKey: hmac(secret, "interaction-rate", address),
  };
}
