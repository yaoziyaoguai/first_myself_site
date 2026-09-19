import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { siteDefaults, type ContactMethod, type Direction } from "@/content/siteDefaults";
import { buildContactMethods } from "@/lib/contact";
import { resolveArray, resolveText } from "@/lib/contentFallback";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "联系",
  description: `通过公开邮箱或 GitHub 联系 ${siteDefaults.identity.name}。`,
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const payload = await getPayloadAPI();
  const [contact, settings] = await Promise.all([
    payload.findGlobal({ slug: "contact" }),
    payload.findGlobal({ slug: "site-settings" }),
  ]);

  const introText = resolveText(contact?.introText, siteDefaults.contact.introText);
  const email = resolveText(settings?.email, siteDefaults.identity.email);
  const contactMethods = buildContactMethods(
    email,
    resolveArray<ContactMethod>(contact?.contactMethods, siteDefaults.contact.methods),
  );
  const discussionTopics = resolveArray<Direction>(
    contact?.discussionTopics,
    siteDefaults.contact.topics,
  );

  return (
    <div className="site-shell page-space">
      <header className="page-header">
        <p className="eyebrow">CONTACT</p>
        <h1>从公开的地方开始交流。</h1>
        <p>{introText}</p>
      </header>

      <div className="grid gap-12 border-t border-border pt-10 md:grid-cols-[minmax(0,1fr)_minmax(17rem,0.55fr)]">
        <div className="border-y border-border">
          {contactMethods.map((method) => (
            <Link
              className="group flex min-h-40 items-end justify-between gap-6 border-b border-border py-7 transition-colors duration-200 last:border-b-0 hover:bg-card/70 md:px-4"
              href={method.href}
              key={`${method.title}-${method.href}`}
              rel={method.href.startsWith("http") ? "noopener noreferrer" : undefined}
              target={method.href.startsWith("http") ? "_blank" : undefined}
            >
              <span>
                <span className="block text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {method.title}
                </span>
                <span className="mt-5 block font-serif text-2xl font-medium">{method.value}</span>
                {method.description ? (
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    {method.description}
                  </span>
                ) : null}
              </span>
              <ArrowUpRight aria-hidden="true" className="shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>

        <aside className="border-t-2 border-primary pt-6">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-primary">可以聊聊</p>
          <ul className="mt-6 space-y-4">
            {discussionTopics.map((topic) => (
              <li className="border-b border-border pb-4 text-sm leading-6 text-muted-foreground" key={topic.label}>
                {topic.label}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
