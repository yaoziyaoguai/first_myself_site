"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { List } from "lucide-react";

type Section = { id: string; title: string; nested: boolean };

/** 从已渲染的正文获取目录和阅读位置。 */
export function ArticleReadingNav({ articleSlug }: { articleSlug: string }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const disclosure = useRef<HTMLDetailsElement>(null);
  const minimap = useRef<HTMLDivElement>(null);
  const currentIndex = Math.min(active, Math.max(0, sections.length - 1));

  useEffect(() => {
    const content = document.getElementById("article-content")!;
    const headings = Array.from(content.querySelectorAll<HTMLElement>(":is(h2, h3)[id]"))
      .filter((heading) => heading.textContent!.trim());
    let frame = 0;
    const shell = content.closest(".site-shell")!;
    const nav = document.querySelector(".site-nav")!;
    let previousY = window.scrollY;
    let dockHidden = false;
    let peakY = previousY;

    function update() {
      frame = 0;
      const scrollY = window.scrollY;
      const travel = Math.max(1, content.getBoundingClientRect().bottom + scrollY - window.innerHeight);
      setProgress(Math.min(100, Math.max(0, Math.round(100 * scrollY / travel))));

      if (scrollY <= 0 || scrollY >= travel) {
        dockHidden = false;
      } else if (dockHidden) {
        peakY = Math.max(peakY, scrollY);
        dockHidden = peakY - scrollY < 12;
      } else if (scrollY > 160 && scrollY > previousY) {
        dockHidden = true;
        peakY = scrollY;
      }
      previousY = scrollY;
      shell.toggleAttribute("data-dock-hidden", dockHidden);

      const navHeight = nav.getBoundingClientRect().height;
      const index = headings.findLastIndex((heading) => heading.getBoundingClientRect().top <= navHeight + 64);
      setActive(Math.max(0, index));
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(() => {
      setSections(headings.map((heading) => ({
        id: heading.id,
        title: heading.textContent!.trim(),
        nested: heading.tagName === "H3",
      })));
      update();
    });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(content);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      shell.removeAttribute("data-dock-hidden");
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [articleSlug]);

  useLayoutEffect(() => {
    const map = minimap.current;
    if (!map) return;
    const link = map.querySelectorAll<HTMLElement>("a")[currentIndex];
    function positionCursor() {
      map!.style.setProperty("--reading-cursor-y", `${link.offsetTop}px`);
      map!.style.setProperty("--reading-cursor-height", `${link.offsetHeight}px`);
    }
    positionCursor();
    const observer = new ResizeObserver(positionCursor);
    observer.observe(map);
    return () => observer.disconnect();
  }, [currentIndex, sections]);

  const links = (
    <ol className="reading-nav-list">
      {sections.map((section, index) => (
        <li key={section.id} className={section.nested ? "reading-nav-subsection" : undefined}>
          <a
            href={`#${encodeURIComponent(section.id)}`}
            aria-current={currentIndex === index ? "location" : undefined}
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
            <div className="reading-nav-viewport">
              <div className="reading-nav-minimap" ref={minimap}>
                <span className="reading-nav-cursor" aria-hidden="true" />
                {links}
              </div>
            </div>
            <div className="reading-nav-footer">
              <span>READ {progress}%</span>
              <a href="#blog-article-top" className="reading-nav-top">回到顶部 ↑</a>
            </div>
          </nav>
          <details ref={disclosure} className="reading-nav-mobile">
            <summary>
              <List size={15} aria-hidden="true" />
              <span>章节 <span>{String(currentIndex + 1).padStart(2, "0")}/{String(sections.length).padStart(2, "0")}</span></span>
            </summary>
            <nav aria-label="移动端本文目录">{links}</nav>
          </details>
        </aside>
      )}
    </>
  );
}
