import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
const font = readFile(join(process.cwd(), "src/assets/og/NotoSansSC-Semibold.woff"));

export async function createOpenGraphImage(title: string, detail: string, cacheControl?: string) {
  const headline = title.length > 90 ? `${title.slice(0, 89)}…` : title;
  const fontSize = headline.length > 52 ? 54 : headline.length > 34 ? 66 : 78;
  return new ImageResponse(
    (
      <div style={{
        display: "flex", flexDirection: "column", width: "100%", height: "100%",
        background: "#090a0f", color: "#f2f5f9", borderTop: "4px solid #3b82f6",
        padding: "60px 76px 52px", fontFamily: "Noto Sans SC", fontWeight: 600,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 18,
          color: "#a4adbb", fontSize: 21, letterSpacing: 3,
        }}>
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 64, height: 48, color: "#f2f5f9", background: "#161a26",
            border: "1px solid #343d50", borderRadius: 8, letterSpacing: 0,
          }}>[JW]</span>
          <span>JINKUN WANG · ENGINEERING MONOGRAPH</span>
        </div>
        <div lang="zh-CN" style={{
          display: "flex", alignItems: "center", flexGrow: 1,
          fontSize, lineHeight: 1.22,
        }}>
          {headline}
        </div>
        <div lang="zh-CN" style={{
          display: "flex", justifyContent: "space-between", borderTop: "1px solid #303746",
          paddingTop: 20, fontSize: 23, letterSpacing: 1, color: "#a4adbb",
        }}>
          <span>{detail}</span>
          <span>wangjinkun333.me</span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [{ name: "Noto Sans SC", data: await font, weight: 600, style: "normal" }],
      headers: cacheControl ? { "Cache-Control": cacheControl } : undefined,
    },
  );
}
