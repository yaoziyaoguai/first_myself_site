import type { BlogAgentRepository, PersistentGenerationLimits } from "./repository";

export type GenerationUsageLimits = PersistentGenerationLimits & {
  perIdentityConcurrency: number;
  globalConcurrency: number;
};

export type GenerationOperationResult<T> = {
  value: T;
  usage: { inputTokens: number; outputTokens: number };
};

export type GenerationUsageResult<T> =
  | { allowed: true; value: T }
  | { allowed: false; reason: "rate-limited" };

export class GenerationUsagePolicy {
  private activeGlobal = 0;
  private readonly activeByIdentity = new Map<string, number>();

  constructor(
    private readonly repository: BlogAgentRepository,
    private readonly limits: GenerationUsageLimits,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run<T>(
    identityHash: string,
    operation: () => Promise<GenerationOperationResult<T>>,
  ): Promise<GenerationUsageResult<T>> {
    const identityActive = this.activeByIdentity.get(identityHash) ?? 0;
    if (
      identityActive >= this.limits.perIdentityConcurrency ||
      this.activeGlobal >= this.limits.globalConcurrency
    ) {
      return { allowed: false, reason: "rate-limited" };
    }

    this.activeGlobal += 1;
    this.activeByIdentity.set(identityHash, identityActive + 1);
    try {
      const reservationTime = this.now();
      const reservation = await this.repository.reserveGeneration({
        identityHash,
        now: reservationTime,
        limits: this.limits,
      });
      if (!reservation.allowed) {
        return { allowed: false, reason: "rate-limited" };
      }

      const result = await operation();
      await this.repository.recordTokenUsage({
        identityHash,
        now: reservationTime,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });
      return { allowed: true, value: result.value };
    } finally {
      const remaining = (this.activeByIdentity.get(identityHash) ?? 1) - 1;
      if (remaining <= 0) this.activeByIdentity.delete(identityHash);
      else this.activeByIdentity.set(identityHash, remaining);
      this.activeGlobal = Math.max(0, this.activeGlobal - 1);
    }
  }
}
