"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const navLinks = [
  { href: "/", label: "首页" },
  { href: "/blog", label: "文章" },
  { href: "/projects", label: "项目" },
  { href: "/about", label: "关于" },
  { href: "/contact", label: "联系" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggle = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);

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
      <div className="site-shell flex h-[4.25rem] items-center justify-between">
        <Link
          prefetch={false}
          className="group inline-flex min-h-11 items-center gap-3"
          href="/"
          onClick={() => setOpen(false)}
        >
          <span className="grid size-8 place-items-center rounded-[0.45rem] border border-primary/25 bg-primary text-[0.68rem] font-semibold tracking-[-0.02em] text-primary-foreground transition-transform duration-200 group-hover:-rotate-3">
            JW
          </span>
          <span className="flex items-baseline gap-2">
            <span className="font-serif text-base font-semibold tracking-[-0.02em]">
              Jinkun Wang
            </span>
            <span className="hidden font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground sm:inline">
              Field Notes
            </span>
          </span>
        </Link>

        <nav
          aria-label="主要导航"
          className="hidden items-center gap-1 md:flex"
        >
          {navLinks.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center px-3 text-sm transition-colors duration-200 after:absolute after:inset-x-3 after:bottom-1.5 after:h-px after:origin-left after:bg-primary after:transition-transform after:duration-200 ${
                  active
                    ? "text-foreground after:scale-x-100"
                    : "text-muted-foreground after:scale-x-0 hover:text-foreground hover:after:scale-x-100"
                }`}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

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

      {open ? (
        <nav
          aria-label="移动端导航"
          className="border-t border-border bg-background md:hidden"
          id="mobile-navigation"
        >
          <div className="site-shell grid py-3">
            {navLinks.map((link, index) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 items-center justify-between border-b border-border/70 text-sm ${active ? "text-primary" : "text-foreground"}`}
                  href={link.href}
                  key={link.href}
                  onClick={() => setOpen(false)}
                >
                  <span>{link.label}</span>
                  <span
                    className="font-mono text-[0.65rem] text-muted-foreground"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
