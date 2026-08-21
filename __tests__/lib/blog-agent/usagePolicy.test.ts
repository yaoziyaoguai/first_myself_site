import { describe, expect, it, vi } from "vitest";
import type { BlogAgentRepository } from "@/lib/blog-agent/repository";
import { GenerationUsagePolicy } from "@/lib/blog-agent/usagePolicy";

function createRepository(): BlogAgentRepository {
  return {
    reserveGeneration: vi.fn().mockResolvedValue({ allowed: true }),
    recordTokenUsage: vi.fn().mockResolvedValue(undefined),
    getCachedAnswer: vi.fn().mockResolvedValue(null),
    setCachedAnswer: vi.fn().mockResolvedValue(undefined),
  };
}

const limits = {
  windowMs: 600_000,
  perIdentityWindow: 3,
  perIdentityDaily: 20,
  globalDaily: 100,
  perIdentityConcurrency: 1,
  globalConcurrency: 3,
};

describe("GenerationUsagePolicy", () => {
  it("does not execute generation when persistent quota denies it", async () => {
    const repository = createRepository();
    vi.mocked(repository.reserveGeneration).mockResolvedValue({ allowed: false, reason: "window" });
    const policy = new GenerationUsagePolicy(repository, limits);
    const operation = vi.fn();

    await expect(policy.run("identity-hash", operation)).resolves.toEqual({
      allowed: false,
      reason: "rate-limited",
    });
    expect(operation).not.toHaveBeenCalled();
    expect(repository.recordTokenUsage).not.toHaveBeenCalled();
  });

  it("records safe token usage after successful generation", async () => {
    const repository = createRepository();
    const policy = new GenerationUsagePolicy(repository, limits);

    await expect(policy.run("identity-hash", async () => ({
      value: "answer",
      usage: { inputTokens: 12, outputTokens: 4 },
    }))).resolves.toEqual({ allowed: true, value: "answer" });
    expect(repository.recordTokenUsage).toHaveBeenCalledWith(expect.objectContaining({
      identityHash: "identity-hash",
      inputTokens: 12,
      outputTokens: 4,
    }));
  });

  it("releases process-local concurrency exactly once after failure", async () => {
    const repository = createRepository();
    const policy = new GenerationUsagePolicy(repository, limits);
    let rejectFirst: ((reason: Error) => void) | undefined;
    const first = policy.run("same-identity", () => new Promise<never>((_, reject) => {
      rejectFirst = reject;
    }));

    await Promise.resolve();
    await expect(policy.run("same-identity", vi.fn(async () => ({
      value: "blocked",
      usage: { inputTokens: 0, outputTokens: 0 },
    })))).resolves.toEqual({
      allowed: false,
      reason: "rate-limited",
    });

    rejectFirst?.(new Error("provider failed"));
    await expect(first).rejects.toThrow("provider failed");

    await expect(policy.run("same-identity", async () => ({
      value: "recovered",
      usage: { inputTokens: 1, outputTokens: 1 },
    }))).resolves.toEqual({ allowed: true, value: "recovered" });
    expect(repository.reserveGeneration).toHaveBeenCalledTimes(2);
  });
});
