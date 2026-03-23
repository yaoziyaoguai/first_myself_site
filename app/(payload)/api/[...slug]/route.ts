import config from "../../../../payload.config";
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
} from "@payloadcms/next/routes";

// Payload route handlers 返回类型与 Next.js 期望类型不完全匹配，
// 需要类型断言。这是 Payload + Next.js 集成的已知问题。
/* eslint-disable @typescript-eslint/no-explicit-any */
export const GET = REST_GET(config) as any;
export const POST = REST_POST(config) as any;
export const DELETE = REST_DELETE(config) as any;
export const PATCH = REST_PATCH(config) as any;
export const OPTIONS = REST_OPTIONS(config) as any;
/* eslint-enable @typescript-eslint/no-explicit-any */
