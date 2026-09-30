import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { postgresAdapter } from "@payloadcms/db-postgres";
import {
  buildConfig,
  getPayload,
  type CollectionAfterChangeHook,
  type Payload,
} from "payload";
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from "../helpers/blogAgentPostgres";

const revalidateVisitorContent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/visitorContentCache", () => ({ revalidateVisitorContent }));

import Blog from "@/payload/collections/Blog";

const describePostgres = process.env.BLOG_AGENT_TEST_DATABASE_URL
  ? describe
  : describe.skip;

function productionInvalidationHook(): CollectionAfterChangeHook {
  const hook = Blog.hooks?.afterChange?.[0];
  if (typeof hook !== "function") throw new Error("Blog invalidation hook is missing");
  return hook;
}

describePostgres("content cache invalidation transaction on PostgreSQL 15", () => {
  let database: IsolatedPostgresDatabase;
  let payload: Payload;

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase();
    const config = await buildConfig({
      secret: "cache-invalidation-test-secret-32-chars",
      db: postgresAdapter({
        pool: { connectionString: database.connectionString },
        push: true,
      }),
      collections: [
        {
          slug: "cache-test-blogs",
          disableBulkEdit: true,
          disableBulkDelete: true,
          hooks: { afterChange: [productionInvalidationHook()] },
          fields: [
            { name: "title", type: "text", required: true },
            {
              name: "status",
              type: "select",
              required: true,
              options: ["draft", "published"],
            },
            {
              name: "visibility",
              type: "select",
              required: true,
              options: ["public", "private"],
            },
          ],
        },
      ],
    });
    payload = await getPayload({ config });
  }, 60_000);

  afterAll(async () => {
    const adapterPool = (payload?.db as unknown as {
      pool?: {
        on: (event: "error", listener: () => void) => void;
      };
    })?.pool;
    // Payload 3.87 的 postgres destroy 不关闭底层 pg.Pool。先接住测试库被
    // terminate 时的预期连接错误；隔离库清理会终止这个池的全部连接。
    adapterPool?.on("error", () => undefined);
    await payload?.destroy();
    await database?.destroy();
  }, 30_000);

  it("rolls back a public-to-private by-ID update when cache invalidation fails", async () => {
    revalidateVisitorContent.mockResolvedValueOnce(undefined);
    const created = await payload.create({
      collection: "cache-test-blogs" as never,
      data: {
        title: "公开文章",
        status: "published",
        visibility: "public",
      } as never,
    });

    revalidateVisitorContent.mockRejectedValueOnce(
      new Error("simulated cache invalidation failure"),
    );
    await expect(payload.update({
      collection: "cache-test-blogs" as never,
      id: created.id,
      data: { visibility: "private" } as never,
    })).rejects.toThrow("simulated cache invalidation failure");

    await expect(payload.findByID({
      collection: "cache-test-blogs" as never,
      id: created.id,
    })).resolves.toMatchObject({
      status: "published",
      visibility: "public",
    });
  });
});
