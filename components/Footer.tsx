import Link from "next/link";
import { getPayloadAPI } from "@/lib/payload";

export async function Footer() {
  const payload = await getPayloadAPI();
  const settings = await payload.findGlobal({ slug: "site-settings" });

  const name = settings?.name || "Jinkun Wang";
  const bioShort = (settings?.bioShort as string) || "";
  const socialLinks =
    (settings?.socialLinks as { href: string; label: string }[]) || [];

  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            &copy; {currentYear} {name}. All rights reserved.
          </div>

          <div className="flex items-center gap-6">
            {socialLinks.map((link, index) => (
              <span key={link.href} className="flex items-center gap-6">
                {index > 0 && (
                  <div className="h-4 w-px bg-border" />
                )}
                <Link
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              </span>
            ))}
          </div>
        </div>

        {bioShort && (
          <div className="mt-4 text-center text-xs text-muted-foreground">
            {bioShort}
          </div>
        )}
      </div>
    </footer>
  );
}
