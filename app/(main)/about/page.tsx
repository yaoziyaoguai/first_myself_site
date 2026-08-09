import type { Metadata } from "next";
import { siteDefaults, type ContentCard, type TechGroup } from "@/content/siteDefaults";
import { resolveArray, resolveText } from "@/lib/contentFallback";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "关于",
  description: "从数据工程出发，学习 AI 评测与 Agent 系统的个人介绍。",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const payload = await getPayloadAPI();
  const [settings, about] = await Promise.all([
    payload.findGlobal({ slug: "site-settings" }),
    payload.findGlobal({ slug: "about" }),
  ]);

  const name = resolveText(settings?.name, siteDefaults.identity.name);
  const introText = resolveText(about?.introText, siteDefaults.about.introText);
  const workDirections = resolveArray<ContentCard>(
    about?.workDirections,
    siteDefaults.about.workDirections,
  );
  const techStack = resolveArray<TechGroup>(
    about?.techStack,
    siteDefaults.about.techStack,
  );
  const focusAreas = resolveArray<ContentCard>(
    about?.focusAreas,
    siteDefaults.about.focusAreas,
  );

  return (
    <div className="site-shell page-space">
      <header className="page-header">
        <p className="eyebrow">ABOUT</p>
        <h1>保持好奇，也保持诚实。</h1>
        <p>
          我是 {name}。{introText}
        </p>
      </header>

      <section className="section-grid">
        <div>
          <p className="section-number">01</p>
          <h2 className="section-title">当前方向</h2>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {workDirections.map((direction) => (
            <article className="grid gap-3 py-7 sm:grid-cols-[11rem_1fr]" key={direction.title}>
              <h3 className="font-medium">{direction.title}</h3>
              <p className="text-sm leading-7 text-muted-foreground">{direction.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid">
        <div>
          <p className="section-number">02</p>
          <h2 className="section-title">使用中的工具</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {techStack.map((group) => (
            <article className="rounded-2xl border border-border bg-card p-6" key={group.category}>
              <h3 className="text-sm font-medium">{group.category}</h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {group.items.split(",").map((item) => item.trim()).join(" · ")}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid">
        <div>
          <p className="section-number">03</p>
          <h2 className="section-title">反复追问的问题</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {focusAreas.map((area) => (
            <article className="rounded-2xl bg-foreground p-7 text-background" key={area.title}>
              <h3 className="text-lg font-medium">{area.title}</h3>
              <p className="mt-3 text-sm leading-7 text-background/70">{area.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
