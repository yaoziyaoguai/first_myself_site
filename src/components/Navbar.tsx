"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "首页" },
  { href: "/about", label: "关于" },
  { href: "/projects", label: "项目" },
  { href: "/blog", label: "文章" },
  { href: "/contact", label: "联系" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="site-shell flex h-[4.5rem] items-center justify-between">
        <Link className="inline-flex min-h-11 items-center gap-3 font-semibold tracking-tight" href="/">
          <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            JW
          </span>
          <span>Jinkun / Notes</span>
        </Link>

        <nav aria-label="主要导航" className="hidden items-center md:flex">
          {navLinks.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm transition-colors ${
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
          aria-controls="mobile-navigation"
          aria-expanded={open}
          aria-label={open ? "关闭菜单" : "打开菜单"}
          className="grid min-h-11 min-w-11 place-items-center rounded-full border border-border md:hidden"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <span className="relative block h-4 w-5" aria-hidden="true">
            <span className={`absolute left-0 top-1 block h-px w-5 bg-foreground transition-transform ${open ? "translate-y-1 rotate-45" : ""}`} />
            <span className={`absolute bottom-1 left-0 block h-px w-5 bg-foreground transition-transform ${open ? "-translate-y-1 -rotate-45" : ""}`} />
          </span>
        </button>
      </div>

      {open ? (
        <nav aria-label="移动端导航" className="border-t border-border bg-background md:hidden" id="mobile-navigation">
          <div className="site-shell grid py-3">
            {navLinks.map((link) => (
              <Link
                className="flex min-h-12 items-center justify-between border-b border-border/70 text-sm"
                href={link.href}
                key={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
