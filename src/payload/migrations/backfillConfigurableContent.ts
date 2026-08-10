import type { BasePayload } from "payload";
import { siteDefaults } from "@/content/siteDefaults";
import { resolveArray, resolveText } from "@/lib/contentFallback";

export const CONFIGURABLE_CONTENT_VERSION = 1;

export async function backfillConfigurableContent(
  payload: BasePayload,
): Promise<boolean> {
  const settings = await payload.findGlobal({
    slug: "site-settings",
    overrideAccess: true,
    showHiddenFields: true,
  });

  if (Number(settings?.contentVersion ?? 0) >= CONFIGURABLE_CONTENT_VERSION) {
    return false;
  }

  const [home, about, contact] = await Promise.all([
    payload.findGlobal({ slug: "home", overrideAccess: true }),
    payload.findGlobal({ slug: "about", overrideAccess: true }),
    payload.findGlobal({ slug: "contact", overrideAccess: true }),
  ]);

  await payload.updateGlobal({
    slug: "home",
    data: {
      title: resolveText(home?.title, siteDefaults.identity.name),
      role: resolveText(home?.role, siteDefaults.identity.role),
      bio: resolveText(home?.bio, siteDefaults.identity.bio),
      directions: resolveArray(home?.directions, siteDefaults.home.directions),
      capabilities: resolveArray(
        home?.capabilities,
        siteDefaults.home.learningAreas,
      ),
    },
    overrideAccess: true,
  });

  await payload.updateGlobal({
    slug: "about",
    data: {
      introText: resolveText(about?.introText, siteDefaults.about.introText),
      workDirections: resolveArray(
        about?.workDirections,
        siteDefaults.about.workDirections,
      ),
      techStack: resolveArray(about?.techStack, siteDefaults.about.techStack),
      focusAreas: resolveArray(about?.focusAreas, siteDefaults.about.focusAreas),
    },
    overrideAccess: true,
  });

  await payload.updateGlobal({
    slug: "contact",
    data: {
      introText: resolveText(contact?.introText, siteDefaults.contact.introText),
      contactMethods: resolveArray(
        contact?.contactMethods,
        siteDefaults.contact.methods,
      ),
      discussionTopics: resolveArray(
        contact?.discussionTopics,
        siteDefaults.contact.topics,
      ),
    },
    overrideAccess: true,
  });

  for (const [index, project] of siteDefaults.projects.entries()) {
    const existing = await payload.find({
      collection: "projects",
      where: { slug: { equals: project.slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    if (existing.docs.length === 0) {
      await payload.create({
        collection: "projects",
        data: {
          title: project.title,
          slug: project.slug,
          role: project.role,
          period: project.period,
          description: project.description,
          href: project.href,
          tags: project.tags.map((item) => ({ ...item })),
          highlights: project.highlights.map((item) => ({ ...item })),
          sortOrder: index + 1,
        },
        overrideAccess: true,
      });
    }
  }

  await payload.updateGlobal({
    slug: "site-settings",
    data: {
      name: resolveText(settings?.name, siteDefaults.identity.name),
      nameShort: resolveText(settings?.nameShort, siteDefaults.identity.nameShort),
      bioShort: resolveText(settings?.bioShort, siteDefaults.identity.role),
      email: resolveText(settings?.email, siteDefaults.identity.email),
      socialLinks: resolveArray(
        settings?.socialLinks,
        siteDefaults.contact.methods.map((method) => ({
          href: method.href,
          label: method.title,
        })),
      ),
      contentVersion: CONFIGURABLE_CONTENT_VERSION,
    },
    overrideAccess: true,
  });

  return true;
}
