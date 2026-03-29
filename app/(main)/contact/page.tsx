import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <h1 className="text-3xl md:text-4xl font-bold mb-4">联系我</h1>
        <p className="text-lg text-muted-foreground">{introText}</p>
      </section>

      <div className="max-w-2xl mx-auto space-y-6">
        {contactMethods.map((method) => (
          <Card
            key={method.title}
            className="hover:shadow-md transition-shadow"
          >
            <CardHeader>
              <CardTitle className="text-lg">{method.title}</CardTitle>
            </CardHeader>
            <CardContent>
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
                className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                前往 {method.title}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {discussionTopics.length > 0 && (
        <section className="max-w-2xl mx-auto mt-16">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">我乐于交流的话题</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {discussionTopics.map((topic) => (
                  <li key={topic.label}>{topic.label}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
