"use client";

import Link from "next/link";

export default function MainError() {
  return (
    <section className="site-shell page-space" aria-labelledby="error-title">
      <header className="page-header">
        <p className="eyebrow">加载异常</p>
        <h1 id="error-title">这页暂时无法打开</h1>
        <p>请重新加载页面，或回到首页继续浏览。</p>
      </header>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <button className="text-link" type="button" onClick={() => window.location.reload()}>
          重新加载当前页
        </button>
        <Link className="text-link" href="/">返回首页</Link>
      </div>
    </section>
  );
}
