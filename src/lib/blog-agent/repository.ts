export type PersistentGenerationLimits = {
  windowMs: number;
  perIdentityWindow: number;
  perIdentityDaily: number;
  globalDaily: number;
};

export type GenerationReservationReason =
  | "window"
  | "identity-daily"
  | "global-daily";

export type GenerationReservation =
  | { allowed: true }
  | { allowed: false; reason: GenerationReservationReason };

export type CachedGroundedAnswer = {
  answer: string;
  citationIds: string[];
  insufficientEvidence: boolean;
};

export type BlogAgentCacheKey = {
  articleHash: string;
  modelCacheKey: string;
  questionHash: string;
};

export interface BlogAgentRepository {
  reserveGeneration(request: {
    identityHash: string;
    now: Date;
    limits: PersistentGenerationLimits;
  }): Promise<GenerationReservation>;

  recordTokenUsage(request: {
    identityHash: string;
    now: Date;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void>;

  getCachedAnswer(
    request: BlogAgentCacheKey & { now: Date },
  ): Promise<CachedGroundedAnswer | null>;

  setCachedAnswer(
    request: BlogAgentCacheKey & {
      answer: CachedGroundedAnswer;
      expiresAt: Date;
    },
  ): Promise<void>;
}
