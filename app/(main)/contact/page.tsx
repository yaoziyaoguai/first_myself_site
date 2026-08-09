import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { siteDefaults, type ContactMethod, type Direction } from "@/content/siteDefaults";
import { resolveArray, resolveText } from "@/lib/contentFallback";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "联系",
  description: "通过公开 GitHub 主页联系 Jinkun Wang。",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const payload = await getPayloadAPI();
  const contact = await payload.findGlobal({ slug: "contact" });

  const introText = resolveText(contact?.introText, siteDefaults.contact.introText);
  const contactMethods = resolveArray<ContactMethod>(
    contact?.contactMethods,
    siteDefaults.contact.methods,
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

      <div className="grid gap-8 border-t border-border pt-10 md:grid-cols-[minmax(0,1fr)_minmax(17rem,0.6fr)]">
        <div className="space-y-4">
          {contactMethods.map((method) => (
            <Link
              className="group flex min-h-44 items-end justify-between gap-6 rounded-2xl border border-border bg-card p-7 transition-colors hover:bg-muted"
              href={method.href}
              key={`${method.title}-${method.href}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span>
                <span className="block text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {method.title}
                </span>
                <span className="mt-5 block text-xl font-medium">{method.value}</span>
                {method.description ? (
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    {method.description}
                  </span>
                ) : null}
              </span>
              <ArrowUpRight aria-hidden="true" className="shrink-0" />
            </Link>
          ))}
        </div>

        <aside className="rounded-2xl bg-foreground p-7 text-background">
          <p className="text-xs uppercase tracking-[0.18em] text-background/60">可以聊聊</p>
          <ul className="mt-6 space-y-4">
            {discussionTopics.map((topic) => (
              <li className="border-b border-background/15 pb-4 text-sm leading-6" key={topic.label}>
                {topic.label}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
