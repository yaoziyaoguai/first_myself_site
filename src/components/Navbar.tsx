"use client";

import Link from "next/link";
import { CommandMenu } from "@/components/CommandMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const navLinks = [
  { href: "/", label: "首页", segment: "" },
  { href: "/blog", label: "文章", segment: "writing" },
  { href: "/projects", label: "项目", segment: "projects" },
  { href: "/about", label: "关于", segment: "about" },
  { href: "/contact", label: "联系", segment: "contact" },
];

export function Navbar({ admin = false }: { admin?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggle = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  const desktopNav = useRef<HTMLElement>(null);
  const current = navLinks.find(({ href }) =>
    pathname === href || pathname.startsWith(href + "/"),
  );

  function followLink(link: HTMLAnchorElement) {
    const nav = desktopNav.current!;
    nav.style.setProperty("--nav-x", `${link.offsetLeft}px`);
    nav.style.setProperty("--nav-width", `${link.offsetWidth}px`);
    nav.dataset.hovering = "true";
  }

  useEffect(() => {
    const onScroll = () => header.current?.setAttribute("data-scrolled", String(window.scrollY > 24));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  return (
    <header ref={header} className="site-nav">
      <div className="site-shell flex h-[var(--nav-height)] items-center justify-between">
        <Link
          prefetch={false}
          className="group inline-flex min-h-11 items-center gap-3"
          href="/"
          onClick={() => setOpen(false)}
        >
          <span aria-hidden="true" className="nav-brand-mark">
            [JW]
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-[-0.02em]">
              Jinkun Wang
            </span>
            {current?.segment && <span className="hidden font-mono text-[0.65rem] text-muted-foreground lg:inline">/ {current.segment}</span>}
          </span>
        </Link>

        <nav
          ref={desktopNav}
          aria-label="主要导航"
          className="site-nav-links hidden items-center gap-1 md:flex"
          onPointerLeave={(event) => delete event.currentTarget.dataset.hovering}
        >
          {navLinks.map((link) => (
              <Link
                prefetch={false}
                aria-current={link === current ? "page" : undefined}
                className="site-nav-link"
                href={link.href}
                key={link.href}
                onPointerEnter={(event) => followLink(event.currentTarget)}
              >
                {link.label}
              </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <CommandMenu routes={navLinks} />
          <ThemeToggle />
          {admin && <Link prefetch={false} href="/admin" className="nav-admin hidden md:inline-flex">Admin ↗</Link>}
        <button
          ref={toggle}
          aria-controls="mobile-navigation"
          aria-expanded={open}
          aria-label={open ? "关闭菜单" : "打开菜单"}
          className="grid min-h-11 min-w-11 place-items-center rounded-[0.45rem] border border-border bg-card transition-colors duration-200 hover:border-primary/50 md:hidden"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <span className="relative block h-4 w-5" aria-hidden="true">
            <span
              className={`absolute left-0 top-1 block h-px w-5 bg-foreground transition-transform ${open ? "translate-y-1 rotate-45" : ""}`}
            />
            <span
              className={`absolute bottom-1 left-0 block h-px w-5 bg-foreground transition-transform ${open ? "-translate-y-1 -rotate-45" : ""}`}
            />
          </span>
        </button>
        </div>
      </div>

      {open ? (
        <nav
          aria-label="移动端导航"
          className="border-t border-border bg-background md:hidden"
          id="mobile-navigation"
        >
          <div className="site-shell grid py-3">
            {navLinks.map((link) => (
                <Link
                  prefetch={false}
                  aria-current={link === current ? "page" : undefined}
                  className={`flex min-h-12 items-center justify-between border-b border-border/70 text-sm ${link === current ? "text-accent-foreground" : "text-foreground"}`}
                  href={link.href}
                  key={link.href}
                  onClick={() => setOpen(false)}
                >
                  <span>{link.label}</span>
                </Link>
            ))}
            {admin && <Link prefetch={false} href="/admin" className="nav-admin mt-3 justify-self-start">后台 ↗</Link>}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
