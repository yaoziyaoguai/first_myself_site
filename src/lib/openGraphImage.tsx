import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
const font = readFile(join(process.cwd(), "src/assets/og/NotoSerifSC-Semibold.woff"));

export async function createOpenGraphImage(title: string, detail: string, cacheControl?: string) {
  const headline = title.length > 90 ? `${title.slice(0, 89)}…` : title;
  const fontSize = headline.length > 52 ? 54 : headline.length > 34 ? 66 : 78;
  return new ImageResponse(
    (
      <div style={{
        display: "flex", flexDirection: "column", width: "100%", height: "100%",
        background: "#f3f0e8", color: "#191915", padding: "64px 76px 52px",
      }}>
        <div style={{
          display: "flex", alignItems: "center", borderTop: "5px solid #1f4f9f",
          paddingTop: 20, color: "#1f4f9f", fontSize: 22, letterSpacing: 4,
        }}>
          JW · FIELD NOTES
        </div>
        <div lang="zh-CN" style={{
          display: "flex", alignItems: "center", flexGrow: 1,
          fontFamily: "Noto Serif SC", fontWeight: 600, fontSize, lineHeight: 1.25,
        }}>
          {headline}
        </div>
        <div lang="zh-CN" style={{
          display: "flex", justifyContent: "space-between", borderTop: "1px solid #cec8bc",
          paddingTop: 20, fontFamily: "Noto Serif SC", fontWeight: 600, fontSize: 25, color: "#656158",
        }}>
          <span>{detail}</span>
          <span>wangjinkun333.me</span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [{ name: "Noto Serif SC", data: await font, weight: 600, style: "normal" }],
      headers: cacheControl ? { "Cache-Control": cacheControl } : undefined,
    },
  );
}
