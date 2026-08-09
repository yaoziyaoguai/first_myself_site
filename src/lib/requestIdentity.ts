import { createHmac } from "node:crypto";
import { getClientIp } from "./rateLimit";

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

export function deriveRequestIdentity(
  request: Request,
  secret = process.env.PAYLOAD_SECRET ?? "",
): RequestIdentity {
  if (!secret) {
    throw new Error("PAYLOAD_SECRET is required to derive request identity");
  }

  const address = getClientIp(request);
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, 512);

  return {
    ipHash: hmac(secret, "interaction-ip", address),
    fingerprint: hmac(secret, "interaction-client", `${address}\0${userAgent}`),
    rateLimitKey: hmac(secret, "interaction-rate", address),
  };
}
