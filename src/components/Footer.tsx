import Link from "next/link";
import { siteDefaults } from "@/content/siteDefaults";
import { resolveArray, resolveText } from "@/lib/contentFallback";
import { buildFooterLinks } from "@/lib/contact";
import { getCurrentUser } from "@/lib/auth";
import { findSiteSettingsForViewer } from "@/lib/visitorContentCache";

export async function Footer() {
  const settings = await findSiteSettingsForViewer(await getCurrentUser());
  const name = resolveText(settings?.name, siteDefaults.identity.name);
  const bioShort = resolveText(settings?.bioShort, siteDefaults.identity.role);
  const email = resolveText(settings?.email, siteDefaults.identity.email);
  const socialLinks = buildFooterLinks(
    email,
    resolveArray<{ href: string; label: string }>(
      settings?.socialLinks,
      siteDefaults.contact.methods.map((method) => ({
        href: method.href,
        label: method.title,
      })),
    ),
  );

  return (
    <footer className="site-footer">
      <div className="site-shell grid gap-6 py-9 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="flex flex-wrap items-baseline gap-2.5 text-sm font-semibold">
            {name}{" "}
            <span className="font-mono text-[0.68rem] font-normal tracking-wide text-muted-foreground">
              / 精密工程志
            </span>
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {bioShort}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-muted-foreground">
            <p className="uppercase tracking-[0.16em]">
              © {new Date().getFullYear()} {name}
            </p>
            <Link
              className="inline-flex min-h-11 items-center underline decoration-border underline-offset-4 transition-colors hover:text-brand-ink"
              href="https://beian.miit.gov.cn/"
              rel="noopener noreferrer"
              target="_blank"
            >
              京ICP备20260057679号-1
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {socialLinks.map((link) => (
            <Link
              className="footer-link"
              href={link.href}
              key={link.href}
              rel={
                link.href.startsWith("http") ? "noopener noreferrer" : undefined
              }
              target={link.href.startsWith("http") ? "_blank" : undefined}
            >
              {link.label} ↗
            </Link>
          ))}
          <Link className="footer-link" href="/rss.xml" prefetch={false}>
            RSS
          </Link>
        </div>
      </div>
    </footer>
  );
}
