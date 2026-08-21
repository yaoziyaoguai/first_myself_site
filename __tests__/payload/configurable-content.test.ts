import { describe, expect, it, vi } from "vitest";
import type { BasePayload } from "payload";
import type {
  MigrateDownArgs,
  MigrateUpArgs,
  PostgresAdapter,
} from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import payloadConfig from "../../payload.config";
import { siteDefaults } from "@/content/siteDefaults";
import Projects from "@/payload/collections/Projects";
import Home from "@/payload/globals/Home";
import SiteSettings from "@/payload/globals/SiteSettings";
import { migrations } from "@/payload/migrations";
import * as configurableContentSchemaMigration from "@/payload/migrations/20260810_000000_add_configurable_content_columns";
import * as blogAgentRuntimeMigration from "@/payload/migrations/20260821_000000_add_blog_agent_runtime";
import {
  CONFIGURABLE_CONTENT_VERSION,
  backfillConfigurableContent,
} from "@/payload/migrations/backfillConfigurableContent";

const castPayload = (mock: Record<string, unknown>): BasePayload =>
  mock as unknown as BasePayload;

describe("configurable portfolio content", () => {
  it("bundles the additive schema migration into the production adapter", async () => {
    const config = await payloadConfig;
    const adapter = config.db.init({
      payload: {} as BasePayload,
    }) as PostgresAdapter;

    expect(adapter.prodMigrations).toBe(migrations);
    expect(migrations).toEqual([
      {
        name: "20260810_000000_add_configurable_content_columns",
        up: configurableContentSchemaMigration.up,
        down: configurableContentSchemaMigration.down,
      },
      {
        name: "20260821_000000_add_blog_agent_runtime",
        up: blogAgentRuntimeMigration.up,
        down: blogAgentRuntimeMigration.down,
      },
    ]);
  });

  it("adds and removes only the configurable-content columns idempotently", async () => {
    const statements: string[] = [];
    const dialect = new PgDialect();
    const db = {
      execute: vi.fn(async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        statements.push(dialect.sqlToQuery(query).sql);
        return { rows: [] };
      }),
    };

    await configurableContentSchemaMigration.up(
      { db } as unknown as MigrateUpArgs,
    );
    await configurableContentSchemaMigration.down(
      { db } as unknown as MigrateDownArgs,
    );

    const upStatement = statements[0].replace(/\s+/g, " ");
    const downStatement = statements[1].replace(/\s+/g, " ");

    expect(upStatement).toContain(
      'ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "href" varchar',
    );
    expect(upStatement).toContain(
      'ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "email" varchar',
    );
    expect(upStatement).toContain(
      'ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "content_version" numeric DEFAULT 0',
    );
    expect(downStatement).toContain(
      'ALTER TABLE "projects" DROP COLUMN IF EXISTS "href"',
    );
    expect(downStatement).toContain(
      'ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "email"',
    );
    expect(downStatement).toContain(
      'ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "content_version"',
    );
    expect(statements.join("\n")).not.toContain("CASCADE");
  });

  it("exposes projects, project links, recent learning, and email clearly in admin", () => {
    expect(Projects.labels).toEqual({
      singular: "项目或实验",
      plural: "项目与实验",
    });
    expect(Projects.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "href", label: "项目链接" }),
      ]),
    );
    expect(Home.label).toBe("首页与最近学习");
    expect(Home.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "capabilities",
          label: "最近在学习",
        }),
      ]),
    );
    expect(SiteSettings.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "email", label: "公开邮箱" }),
        expect.objectContaining({ name: "contentVersion", hidden: true }),
      ]),
    );
  });

  it("moves empty fallback content into Payload without overwriting future edits", async () => {
    const mockPayload = {
      findGlobal: vi.fn(async ({ slug }: { slug: string }) => {
        const globals: Record<string, Record<string, unknown>> = {
          "site-settings": { contentVersion: 0, socialLinks: [] },
          home: { directions: [], capabilities: [] },
          about: { workDirections: [], techStack: [], focusAreas: [] },
          contact: { contactMethods: [], discussionTopics: [] },
        };
        return globals[slug];
      }),
      find: vi.fn().mockResolvedValue({ docs: [] }),
      updateGlobal: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    };

    const changed = await backfillConfigurableContent(castPayload(mockPayload));

    expect(changed).toBe(true);
    expect(mockPayload.updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "home",
        data: expect.objectContaining({
          capabilities: siteDefaults.home.learningAreas,
        }),
      }),
    );
    expect(mockPayload.updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "site-settings",
        data: expect.objectContaining({
          email: siteDefaults.identity.email,
          contentVersion: CONFIGURABLE_CONTENT_VERSION,
        }),
      }),
    );
    expect(mockPayload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "projects",
        data: expect.objectContaining({
          slug: "mindforge",
          href: "https://github.com/yaoziyaoguai/mindforge",
        }),
      }),
    );
  });

  it("does not rerun after the content version has been recorded", async () => {
    const mockPayload = {
      findGlobal: vi.fn().mockResolvedValue({
        contentVersion: CONFIGURABLE_CONTENT_VERSION,
      }),
      find: vi.fn(),
      updateGlobal: vi.fn(),
      create: vi.fn(),
    };

    const changed = await backfillConfigurableContent(castPayload(mockPayload));

    expect(changed).toBe(false);
    expect(mockPayload.findGlobal).toHaveBeenCalledOnce();
    expect(mockPayload.findGlobal).toHaveBeenCalledWith({
      slug: "site-settings",
      overrideAccess: true,
      showHiddenFields: true,
    });
    expect(mockPayload.find).not.toHaveBeenCalled();
    expect(mockPayload.updateGlobal).not.toHaveBeenCalled();
    expect(mockPayload.create).not.toHaveBeenCalled();
  });

  it("keeps existing CMS text and arrays during the first backfill", async () => {
    const customLearning = [
      { title: "自定义学习项", description: "保留后台已经填写的内容" },
    ];
    const mockPayload = {
      findGlobal: vi.fn(async ({ slug }: { slug: string }) => {
        const globals: Record<string, Record<string, unknown>> = {
          "site-settings": {
            contentVersion: 0,
            name: "自定义姓名",
            email: "custom@example.com",
            socialLinks: [
              { href: "https://example.com", label: "自定义链接" },
            ],
          },
          home: {
            title: "自定义首页",
            role: "自定义定位",
            bio: "自定义介绍",
            directions: [{ label: "自定义方向" }],
            capabilities: customLearning,
          },
          about: {
            introText: "自定义关于",
            workDirections: [{ title: "方向", description: "描述" }],
            techStack: [{ category: "工具", items: "SQL" }],
            focusAreas: [{ title: "关注", description: "描述" }],
          },
          contact: {
            introText: "自定义联系说明",
            contactMethods: [
              {
                title: "主页",
                value: "example.com",
                href: "https://example.com",
              },
            ],
            discussionTopics: [{ label: "自定义话题" }],
          },
        };
        return globals[slug];
      }),
      find: vi.fn().mockResolvedValue({ docs: [{ id: 1 }] }),
      updateGlobal: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    };

    await backfillConfigurableContent(castPayload(mockPayload));

    expect(mockPayload.updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "home",
        data: expect.objectContaining({
          title: "自定义首页",
          capabilities: customLearning,
        }),
      }),
    );
    expect(mockPayload.updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "site-settings",
        data: expect.objectContaining({
          name: "自定义姓名",
          email: "custom@example.com",
          socialLinks: [
            { href: "https://example.com", label: "自定义链接" },
          ],
        }),
      }),
    );
    expect(mockPayload.create).not.toHaveBeenCalled();
  });

  it("retries from retained partial state and records the version only after success", async () => {
    const globals: Record<string, Record<string, unknown>> = {
      "site-settings": { contentVersion: 0, socialLinks: [] },
      home: { directions: [], capabilities: [] },
      about: { workDirections: [], techStack: [], focusAreas: [] },
      contact: { contactMethods: [], discussionTopics: [] },
    };
    const projects = new Map<string, Record<string, unknown>>();
    const writes: string[] = [];
    let failSecondProjectOnce = true;
    const mockPayload = {
      findGlobal: vi.fn(async ({ slug }: { slug: string }) => globals[slug]),
      updateGlobal: vi.fn(
        async ({
          slug,
          data,
        }: {
          slug: string;
          data: Record<string, unknown>;
        }) => {
          globals[slug] = { ...globals[slug], ...data };
          writes.push(
            slug === "site-settings" && data.contentVersion
              ? `content-version:${String(data.contentVersion)}`
              : `global:${slug}`,
          );
          return globals[slug];
        },
      ),
      find: vi.fn(
        async ({
          where,
        }: {
          where: { slug: { equals: string } };
        }) => ({
          docs: projects.has(where.slug.equals)
            ? [projects.get(where.slug.equals)]
            : [],
        }),
      ),
      create: vi.fn(
        async ({ data }: { data: Record<string, unknown> }) => {
          const slug = String(data.slug);
          if (slug === "personal-site" && failSecondProjectOnce) {
            failSecondProjectOnce = false;
            throw new Error("injected project write failure");
          }
          projects.set(slug, data);
          writes.push(`project:${slug}`);
          return data;
        },
      ),
    };

    await expect(
      backfillConfigurableContent(castPayload(mockPayload)),
    ).rejects.toThrow("injected project write failure");

    expect(globals["site-settings"].contentVersion).toBe(0);
    expect([...projects.keys()]).toEqual(["mindforge"]);

    writes.length = 0;
    const changed = await backfillConfigurableContent(castPayload(mockPayload));

    expect(changed).toBe(true);
    expect([...projects.keys()]).toEqual(["mindforge", "personal-site"]);
    expect(
      mockPayload.create.mock.calls
        .slice(2)
        .map(([{ data }]) => data.slug),
    ).toEqual(["personal-site"]);
    expect(globals["site-settings"].contentVersion).toBe(
      CONFIGURABLE_CONTENT_VERSION,
    );
    expect(writes.at(-1)).toBe(
      `content-version:${CONFIGURABLE_CONTENT_VERSION}`,
    );
  });
});
