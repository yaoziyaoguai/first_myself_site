import { trustedOrigins } from "@/lib/interactive-html/access";

type JsonRequestResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: 400 | 403 | 413 | 415; error: string };

export async function verifySameOriginJsonRequest(
  request: Request,
  maxBytes = 16 * 1024,
): Promise<JsonRequestResult> {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    !trustedOrigins().includes(origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return { ok: false, status: 403, error: "Forbidden origin" };
  }
  const mediaType = request.headers.get("content-type")
    ?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    return { ok: false, status: 415, error: "Content-Type must be application/json" };
  }

  const tooLarge = { ok: false, status: 413, error: "Request body too large" } as const;
  const invalid = { ok: false, status: 400, error: "Invalid JSON body" } as const;
  if (Number(request.headers.get("content-length")) > maxBytes) return tooLarge;
  if (!request.body) return invalid;

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let json = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return tooLarge;
      }
      json += decoder.decode(value, { stream: true });
    }
    const data: unknown = JSON.parse(json + decoder.decode());
    if (!data || typeof data !== "object" || Array.isArray(data)) return invalid;
    return { ok: true, data: data as Record<string, unknown> };
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError ||
      (error instanceof DOMException && error.name === "AbortError")) return invalid;
    throw error;
  } finally {
    reader.releaseLock();
  }
}
