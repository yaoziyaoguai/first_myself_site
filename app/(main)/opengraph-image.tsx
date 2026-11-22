import { createOpenGraphImage } from "@/lib/openGraphImage";

export const alt = "Jinkun Wang · 精密工程志";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return createOpenGraphImage("数据工程与 AI 学习记录", "精密工程志");
}
