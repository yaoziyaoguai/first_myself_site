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
    <footer className="site-footer">
      <div className="site-shell grid gap-10 py-12 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="font-serif text-xl font-semibold">
            Jinkun Wang{" "}
            <span className="ml-2 font-mono text-xs font-normal tracking-widest text-muted-foreground">
              FIELD NOTES
            </span>
          </p>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            {bioShort}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <p className="uppercase tracking-[0.16em]">
              © {new Date().getFullYear()} {name}
            </p>
            <Link
              className="inline-flex min-h-11 items-center underline decoration-border underline-offset-4 transition-colors hover:text-primary"
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
          <Link className="footer-link" href="/rss.xml">
            RSS
          </Link>
        </div>
      </div>
    </footer>
  );
}
