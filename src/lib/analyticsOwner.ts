import { createHmac, timingSafeEqual } from "node:crypto";

export const OWNER_DEVICE_COOKIE = "site-owner-device";
const OWNER_DEVICE_PURPOSE = "analytics-owner-device:v1";

function ownerDeviceSignature(secret: string) {
  return createHmac("sha256", secret)
    .update(OWNER_DEVICE_PURPOSE)
    .digest("base64url");
}

export function createOwnerDeviceMarker(secret = process.env.PAYLOAD_SECRET) {
  if (!secret) return null;
  return `v1.${ownerDeviceSignature(secret)}`;
}

export function verifyOwnerDeviceMarker(
  marker: string | undefined,
  secret = process.env.PAYLOAD_SECRET,
) {
  if (!marker || !secret) return false;

  const expected = createOwnerDeviceMarker(secret);
  if (!expected) return false;
  const actualBuffer = Buffer.from(marker);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer);
}
