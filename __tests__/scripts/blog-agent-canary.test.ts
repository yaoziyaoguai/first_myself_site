import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { BlogAgentAnswerClient } from "@/lib/blog-agent/answer";
import type { BlogAgentConfig } from "@/lib/blog-agent/config";
import {
  executeBlogAgentCanary,
  parseCanaryArguments,
  type BlogAgentCanaryDependencies,
} from "../../scripts/blog-agent-canary";

const config: BlogAgentConfig = {
  enabled: false,
  generationEnabled: false,
  generationConfigured: true,
  baseUrl: "https://api.deepseek.example",
  apiKey: "super-secret-api-key",
  model: "deepseek-chat",
  modelTimeoutMs: 15_000,
  cacheTtlMs: 86_400_000,
  perIdentityWindow: 3,
  windowMs: 600_000,
  perIdentityDaily: 20,
  globalDaily: 100,
  perIdentityConcurrency: 1,
  globalConcurrency: 3,
};

function createDependencies(options?: {
  article?: Record<string, unknown>;
  client?: BlogAgentAnswerClient;
}) {
  const find = vi.fn().mockResolvedValue({
    docs: [options?.article ?? {
      id: 7,
      slug: "doris-write-path",
      title: "Doris 写入实践",
      excerpt: "批量写入设计",
      contentMarkdown: "# 写入路径\nPRIVATE_MARKDOWN_SENTINEL 使用 batch sink。",
      status: "published",
      visibility: "public",
    }],
  });
  const destroy = vi.fn().mockResolvedValue(undefined);
  const client = options?.client ?? {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        answer: "批量写入减少小批次开销。",
        citationIds: ["section:0:写入路径"],
        insufficientEvidence: false,
      }),
      inputTokens: 13,
      outputTokens: 6,
    }),
  };
  const stdout = vi.fn();
  const stderr = vi.fn();
  const dependencies: BlogAgentCanaryDependencies = {
    readConfig: () => config,
    getPayload: vi.fn().mockResolvedValue({ find, destroy }),
    createClient: () => client,
    createQueryId: () => "query-canary-1",
    stdout,
    stderr,
  };
  return { dependencies, find, destroy, client, stdout, stderr };
}

describe("Blog Agent canary", () => {
  it("runs through the repository CommonJS-compatible tsx entrypoint", () => {
    const result = spawnSync(
      process.execPath,
      [
        resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
        resolve(process.cwd(), "scripts/blog-agent-canary.ts"),
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Blog Agent canary failed");
    expect(result.stderr).not.toContain("Top-level await");
    expect(result.stderr).not.toContain("Transform failed");
  });

  it.each([
    { argv: [] },
    { argv: ["--slug=doris-write-path"] },
    { argv: ["--question=为什么"] },
    { argv: ["--slug=a", "--slug=b", "--question=q"] },
    { argv: ["--slug=a", "--question=q", "--extra=x"] },
  ])("requires exactly one explicit slug and question %#", ({ argv }) => {
    expect(() => parseCanaryArguments(argv)).toThrow();
  });

  it("loads one public article and prints only a redacted result summary", async () => {
    const fixture = createDependencies();
    const code = await executeBlogAgentCanary(
      ["--slug=doris-write-path", "--question=为什么批量写入？"],
      fixture.dependencies,
    );

    expect(code).toBe(0);
    expect(fixture.find).toHaveBeenCalledOnce();
    expect(fixture.find).toHaveBeenCalledWith({
      collection: "blog",
      where: {
        slug: { equals: "doris-write-path" },
        status: { equals: "published" },
        visibility: { equals: "public" },
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        contentMarkdown: true,
        status: true,
        visibility: true,
      },
    });
    expect(fixture.destroy).toHaveBeenCalledOnce();
    const output = fixture.stdout.mock.calls.flat().join("\n");
    expect(output).toContain('"queryId":"query-canary-1"');
    expect(output).toContain('"result":"answered"');
    expect(output).toContain('"inputTokens":13');
    expect(output).toContain('"outputTokens":6');
    expect(output).not.toContain("PRIVATE_MARKDOWN_SENTINEL");
    expect(output).not.toContain(config.apiKey);
    expect(output).not.toContain("为什么批量写入");
    expect(output).not.toContain("DATABASE_URL");
  });

  it.each([
    [{ status: "draft", visibility: "public", contentMarkdown: "# x\ny" }, "draft"],
    [{ status: "published", visibility: "private", contentMarkdown: "# x\ny" }, "private"],
    [{ status: "published", visibility: "public", contentMarkdown: "  " }, "RichText-only"],
  ])("refuses %s articles without invoking the model", async (override) => {
    const fixture = createDependencies({
      article: {
        id: 7,
        slug: "doris-write-path",
        title: "Doris 写入实践",
        excerpt: "",
        ...override,
      },
    });
    const code = await executeBlogAgentCanary(
      ["--slug=doris-write-path", "--question=为什么？"],
      fixture.dependencies,
    );

    expect(code).toBe(1);
    expect(fixture.client.complete).not.toHaveBeenCalled();
    expect(fixture.destroy).toHaveBeenCalledOnce();
  });

  it("redacts provider failures and treats insufficient evidence as failure", async () => {
    const providerFixture = createDependencies({
      client: {
        complete: vi.fn().mockRejectedValue(
          new Error("raw provider body DATABASE_URL=secret api-key=secret"),
        ),
      },
    });
    expect(await executeBlogAgentCanary(
      ["--slug=doris-write-path", "--question=为什么？"],
      providerFixture.dependencies,
    )).toBe(1);
    const errors = providerFixture.stderr.mock.calls.flat().join("\n");
    expect(errors).toBe("Blog Agent canary failed");
    expect(errors).not.toContain("provider body");

    const insufficientFixture = createDependencies({
      client: {
        complete: vi.fn().mockResolvedValue({
          content: JSON.stringify({ answer: "", citationIds: [], insufficientEvidence: true }),
          inputTokens: 3,
          outputTokens: 1,
        }),
      },
    });
    expect(await executeBlogAgentCanary(
      ["--slug=doris-write-path", "--question=未知信息？"],
      insufficientFixture.dependencies,
    )).toBe(1);
    expect(insufficientFixture.stdout).not.toHaveBeenCalled();
  });
});
