import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getClientIp } from "./rateLimit";

export type RequestIdentity = {
  ipHash: string;
  fingerprint: string;
  rateLimitKey: string;
  networkPrefix: string;
};

function hmac(secret: string, purpose: string, value: string): string {
  return createHmac("sha256", secret)
    .update(`${purpose}\0${value}`)
    .digest("hex");
}

function maskIpv4(address: string): string {
  const octets = address.split(".");
  return `${octets[0]}.${octets[1]}.${octets[2]}.*`;
}

function expandIpv6(address: string): number[] | null {
  if (address.includes("%") || address.split("::").length > 2) return null;
  const [head = "", tail = ""] = address.toLowerCase().split("::");
  const parseSide = (value: string): number[] | null => {
    if (!value) return [];
    const groups: number[] = [];
    for (const part of value.split(":")) {
      if (part.includes(".")) {
        if (isIP(part) !== 4) return null;
        const octets = part.split(".").map(Number);
        groups.push((octets[0] << 8) | octets[1]);
        groups.push((octets[2] << 8) | octets[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/u.test(part)) return null;
        groups.push(Number.parseInt(part, 16));
      }
    }
    return groups;
  };
  const headGroups = parseSide(head);
  const tailGroups = parseSide(tail);
  if (!headGroups || !tailGroups) return null;
  const explicit = headGroups.length + tailGroups.length;
  if (!address.includes("::")) return explicit === 8 ? headGroups : null;
  if (explicit >= 8) return null;
  return [
    ...headGroups,
    ...Array.from({ length: 8 - explicit }, () => 0),
    ...tailGroups,
  ];
}

export function maskNetworkPrefix(address: string): string {
  if (isIP(address) === 4) return maskIpv4(address);
  const mappedIpv4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/iu)?.[1];
  if (mappedIpv4 && isIP(mappedIpv4) === 4) return maskIpv4(mappedIpv4);
  if (isIP(address) !== 6 || address.includes("%")) return "";
  const groups = expandIpv6(address);
  if (!groups) return "";
  return `${groups.slice(0, 4).map((group) => group.toString(16)).join(":")}::/64`;
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
    networkPrefix: maskNetworkPrefix(address),
  };
}
