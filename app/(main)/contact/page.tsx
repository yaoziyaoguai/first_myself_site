import Link from "next/link";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const payload = await getPayloadAPI();
  const contact = await payload.findGlobal({ slug: "contact" });

  const introText = (contact?.introText as string) || "";
  const contactMethods =
    (contact?.contactMethods as {
      title: string;
      value: string;
      description?: string;
      href: string;
    }[]) || [];
  const discussionTopics =
    (contact?.discussionTopics as { label: string }[]) || [];

  return (
    <div className="container mx-auto px-4 py-12">
      <section className="max-w-2xl mx-auto mb-12">
        <h1 className="text-4xl md:text-5xl font-medium mb-4" style={{ fontFamily: "'SF Pro Rounded', ui-sans-serif, system-ui" }}>联系我</h1>
        <p className="text-lg text-muted-foreground">{introText}</p>
      </section>

      <div className="max-w-2xl mx-auto space-y-6">
        {contactMethods.map((method) => (
          <div
            key={method.title}
            className="border border-border rounded-lg p-6 bg-background hover:bg-muted transition-colors"
          >
            <h2 className="text-lg font-medium mb-2">{method.title}</h2>
            <p className="text-primary font-medium mb-1">{method.value}</p>
            {method.description && (
              <p className="text-sm text-muted-foreground mb-4">
                {method.description}
              </p>
            )}
            <Link
              href={method.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              前往 {method.title}
            </Link>
          </div>
        ))}
      </div>

      {discussionTopics.length > 0 && (
        <section className="max-w-2xl mx-auto mt-16">
          <div className="border border-border rounded-lg p-6 bg-muted">
            <h2 className="text-lg font-medium mb-4">我乐于交流的话题</h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {discussionTopics.map((topic) => (
                <li key={topic.label}>{topic.label}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
