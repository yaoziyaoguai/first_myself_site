import React from "react";
import Link from "next/link";

/**
 * BackToSite
 * Payload Admin 自定义组件
 * 在导航栏显示"前往前台"入口
 */
export function BackToSite() {
  return (
    <Link
      href="/"
      className="nav__back-to-site"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 16px",
        color: "var(--theme-text)",
        textDecoration: "none",
        fontSize: "14px",
        borderBottom: "1px solid var(--theme-border-color)",
      }}
    >
      <span style={{ marginRight: "6px" }}>←</span>
      <span>前往前台</span>
    </Link>
  );
}
