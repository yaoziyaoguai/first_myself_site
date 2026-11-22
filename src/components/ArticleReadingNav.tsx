"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type Section = { id: string; title: string; nested: boolean };

/** 从已渲染的正文获取目录和阅读位置。 */
export function ArticleReadingNav({ articleSlug }: { articleSlug: string }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const disclosure = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const content = document.getElementById("article-content")!;
    const headings = Array.from(content.querySelectorAll<HTMLElement>(":is(h2, h3)[id]"))
      .filter((heading) => heading.textContent!.trim());
    let frame = 0;
    let idle: ReturnType<typeof setTimeout>;
    const shell = content.closest(".site-shell")!;
    const navHeight = document.querySelector(".site-nav")!.getBoundingClientRect().height;
    function update() {
      frame = 0;
      const bounds = content.getBoundingClientRect();
      const travel = Math.max(1, bounds.height - window.innerHeight + navHeight);
      const percentage = Math.round(100 * (navHeight - bounds.top) / travel);
      setProgress(Math.min(100, Math.max(0, percentage)));
      const index = headings.findLastIndex((heading) => heading.getBoundingClientRect().top <= navHeight + 64);
      setActive(Math.max(0, index));
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    let lastScroll = window.scrollY;
    function onScroll() {
      const current = window.scrollY;
      if (Math.abs(current - lastScroll) >= 4) {
        const hide = current > lastScroll && current > 160;
        shell.setAttribute("data-dock-hidden", String(hide));
        clearTimeout(idle);
        if (hide) idle = setTimeout(() => shell.removeAttribute("data-dock-hidden"), 750);
        lastScroll = current;
      }
      schedule();
    }
    frame = requestAnimationFrame(() => {
      setSections(headings.map((heading) => ({
        id: heading.id,
        title: heading.textContent!.trim(),
        nested: heading.tagName === "H3",
      })));
      update();
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(idle);
      shell.removeAttribute("data-dock-hidden");
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
    };
  }, [articleSlug]);

  const links = (
    <ol className="reading-nav-list">
      {sections.map((section, index) => (
        <li key={section.id} className={section.nested ? "reading-nav-subsection" : undefined}>
          <a
            href={`#${encodeURIComponent(section.id)}`}
            aria-current={active === index ? "location" : undefined}
            onClick={() => {
              setActive(index);
              disclosure.current!.open = false;
              document.getElementById(section.id)!.focus({ preventScroll: true });
            }}
          >
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <progress className="reading-progress" max={100} value={progress} aria-label="阅读进度" />
      {sections.length >= 3 && (
        <aside className="reading-nav">
          <nav aria-label="本文目录" className="reading-nav-desktop">
            <p className="reading-nav-label">本文目录</p>
            {links}
            <div className="reading-nav-footer">
              <span>已读 {progress}%</span>
              <a href="#blog-article-top" className="reading-nav-top">回到顶部 ↑</a>
            </div>
          </nav>
          <details ref={disclosure} className="reading-nav-mobile">
            <summary>
              <span>目录 <span>{active + 1}/{sections.length}</span></span>
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            <nav aria-label="移动端本文目录">{links}</nav>
          </details>
        </aside>
      )}
    </>
  );
}
