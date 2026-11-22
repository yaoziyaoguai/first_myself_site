import { createHash, timingSafeEqual } from "node:crypto";

export function matchesAdminToken(request: Request, token: string): boolean {
  const expected = createHash("sha256").update(`Bearer ${token}`).digest();
  const provided = createHash("sha256")
    .update(request.headers.get("authorization") ?? "")
    .digest();
  return timingSafeEqual(provided, expected);
}
