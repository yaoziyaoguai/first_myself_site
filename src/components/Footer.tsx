import Link from "next/link";
import { siteDefaults } from "@/content/siteDefaults";
import { resolveArray, resolveText } from "@/lib/contentFallback";
import { getPayloadAPI } from "@/lib/payload";

export async function Footer() {
  const payload = await getPayloadAPI();
  const settings = await payload.findGlobal({ slug: "site-settings" });
  const name = resolveText(settings?.name, siteDefaults.identity.name);
  const bioShort = resolveText(settings?.bioShort, siteDefaults.identity.role);
  const socialLinks = resolveArray<{ href: string; label: string }>(
    settings?.socialLinks,
    siteDefaults.contact.methods.map((method) => ({
      href: method.href,
      label: method.title,
    })),
  );

  return (
    <footer className="mt-12 border-t border-border bg-foreground text-background">
      <div className="site-shell grid gap-10 py-12 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="max-w-xl text-2xl font-medium leading-snug tracking-tight">{bioShort}</p>
          <p className="mt-5 text-xs uppercase tracking-[0.16em] text-background/55">
            © {new Date().getFullYear()} {name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {socialLinks.map((link) => (
            <Link
              className="inline-flex min-h-11 items-center rounded-full border border-background/25 px-4 text-sm transition-colors hover:bg-background hover:text-foreground"
              href={link.href}
              key={link.href}
              rel="noopener noreferrer"
              target="_blank"
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
