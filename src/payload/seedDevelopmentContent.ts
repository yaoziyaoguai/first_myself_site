import type { BasePayload } from "payload";
import { siteDefaults } from "@/content/siteDefaults";

export async function seedDevelopmentContent(payload: BasePayload): Promise<string[]> {
  const results: string[] = [];

  await payload.updateGlobal({
    slug: "home",
    data: {
      title: siteDefaults.identity.name,
      role: siteDefaults.identity.role,
      bio: siteDefaults.identity.bio,
      directions: siteDefaults.home.directions.map((item) => ({ ...item })),
      capabilities: siteDefaults.home.learningAreas.map((item) => ({ ...item })),
    },
    overrideAccess: true,
  });
  results.push("✓ Home global seeded");

  await payload.updateGlobal({
    slug: "site-settings",
    data: {
      name: siteDefaults.identity.name,
      nameShort: siteDefaults.identity.nameShort,
      bioShort: siteDefaults.identity.role,
      socialLinks: siteDefaults.contact.methods.map((method) => ({
        href: method.href,
        label: method.title,
      })),
    },
    overrideAccess: true,
  });
  results.push("✓ Site settings seeded");

  await payload.updateGlobal({
    slug: "about",
    data: {
      introText: siteDefaults.about.introText,
      workDirections: siteDefaults.about.workDirections.map((item) => ({ ...item })),
      techStack: siteDefaults.about.techStack.map((item) => ({ ...item })),
      focusAreas: siteDefaults.about.focusAreas.map((item) => ({ ...item })),
    },
    overrideAccess: true,
  });
  results.push("✓ About global seeded");

  await payload.updateGlobal({
    slug: "contact",
    data: {
      introText: siteDefaults.contact.introText,
      contactMethods: siteDefaults.contact.methods.map((item) => ({ ...item })),
      discussionTopics: siteDefaults.contact.topics.map((item) => ({ ...item })),
    },
    overrideAccess: true,
  });
  results.push("✓ Contact global seeded");

  const existingProjects = await payload.count({
    collection: "projects",
    overrideAccess: true,
  });
  if (existingProjects.totalDocs === 0) {
    for (const [index, defaultProject] of siteDefaults.projects.entries()) {
      await payload.create({
        collection: "projects",
        data: {
          title: defaultProject.title,
          slug: defaultProject.slug,
          role: defaultProject.role,
          period: defaultProject.period,
          description: defaultProject.description,
          tags: defaultProject.tags.map((item) => ({ ...item })),
          highlights: defaultProject.highlights.map((item) => ({ ...item })),
          sortOrder: index + 1,
        },
        overrideAccess: true,
      });
    }
    results.push(`✓ ${siteDefaults.projects.length} projects seeded`);
  } else {
    results.push("⊘ Projects already exist, skipping");
  }

  results.push("⊘ User accounts are never created by seed; use explicit create-admin credentials.");
  return results;
}
