"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type Section = { id: string; title: string };

/** 从已经渲染的标题取目录，复用真实锚点，避免在服务端再次解析长 Markdown。 */
export function ArticleReadingNav({ articleSlug }: { articleSlug: string }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState("");
  const disclosure = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const headings = Array.from(
      document.querySelectorAll<HTMLElement>("#article-content h2[id]"),
    );
    if (headings.length < 3) return;
    // 首次布局完成后再读取几何位置；仅排一次帧，不在滚动帧中更新 React 状态。
    const frame = requestAnimationFrame(() => {
      setSections(
        headings.map((heading) => ({
          id: heading.id,
          title: heading.textContent?.trim() || "章节",
        })),
      );
      update();
    });
    const update = () => {
      const passed = headings.filter(
        (heading) => heading.getBoundingClientRect().top <= 144,
      );
      setActive((passed.at(-1) ?? headings[0]).id);
    };
    if (!("IntersectionObserver" in window))
      return () => cancelAnimationFrame(frame);
    const observer = new IntersectionObserver(update, {
      rootMargin: "-112px 0px 0px",
      threshold: 0,
    });
    headings.forEach((heading) => observer.observe(heading));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [articleSlug]);

  if (!sections.length) return null;
  const links = (
    <ol className="reading-nav-list">
      {sections.map((section, index) => (
        <li key={section.id}>
          <a
            href={`#${encodeURIComponent(section.id)}`}
            aria-current={active === section.id ? "location" : undefined}
            onClick={() => {
              setActive(section.id);
              if (disclosure.current) disclosure.current.open = false;
              document
                .getElementById(section.id)
                ?.focus({ preventScroll: true });
            }}
          >
            <span className="reading-nav-number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{section.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <aside className="reading-nav">
      <nav aria-label="本文目录" className="reading-nav-desktop">
        <p className="reading-nav-label">
          本文目录 <span>{sections.length} 节</span>
        </p>
        {links}
        <a href="#blog-article-top" className="reading-nav-top">
          回到文章开头 ↑
        </a>
      </nav>
      <details ref={disclosure} className="reading-nav-mobile">
        <summary>
          <span>
            本文目录{" "}
            <span className="text-muted-foreground">{sections.length} 节</span>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <nav aria-label="移动端本文目录">{links}</nav>
      </details>
    </aside>
  );
}
