import Link from "next/link";
import { siteDefaults } from "@/content/siteDefaults";
import { resolveArray, resolveText } from "@/lib/contentFallback";
import { buildFooterLinks } from "@/lib/contact";
import { getPayloadAPI } from "@/lib/payload";

export async function Footer() {
  const payload = await getPayloadAPI();
  const settings = await payload.findGlobal({ slug: "site-settings" });
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
    <footer className="mt-12 border-t border-border bg-foreground text-background">
      <div className="site-shell grid gap-10 py-12 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="max-w-xl text-2xl font-medium leading-snug tracking-tight">{bioShort}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-background/55">
            <p className="uppercase tracking-[0.16em]">
              © {new Date().getFullYear()} {name}
            </p>
            <Link
              className="underline decoration-background/25 underline-offset-4 transition-colors hover:text-background"
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
              className="inline-flex min-h-11 items-center rounded-full border border-background/25 px-4 text-sm transition-colors hover:bg-background hover:text-foreground"
              href={link.href}
              key={link.href}
              rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
              target={link.href.startsWith("http") ? "_blank" : undefined}
            >
              {link.label} ↗
            </Link>
          ))}
          <Link
            className="inline-flex min-h-11 items-center rounded-full border border-background/25 px-4 text-sm transition-colors hover:bg-background hover:text-foreground"
            href="/rss.xml"
          >
            RSS
          </Link>
        </div>
      </div>
    </footer>
  );
}
