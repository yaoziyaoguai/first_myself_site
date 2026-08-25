export type UnansweredQuestionReason =
  | "insufficient_evidence"
  | "rate_limited"
  | "provider_error";

export type UnansweredQuestionEvent = {
  queryId: string;
  articleSlug: string;
  questionExcerpt: string;
  reason: UnansweredQuestionReason;
  createdAt: Date;
};

export interface UnansweredQuestionRecorder {
  record(event: UnansweredQuestionEvent): Promise<void>;
}

const CREDENTIAL_MARKER = "[凭据已脱敏]";
const EMAIL_MARKER = "[邮箱已脱敏]";
const PRIVATE_KEY_PATTERN =
  /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z0-9]+)* PRIVATE KEY-----/giu;
const EMAIL_PATTERN =
  /\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+\b/giu;
const BEARER_PATTERN = /\bBearer\s+[A-Z0-9._~+/=-]{8,}/giu;
const JWT_PATTERN = /\beyJ[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}\b/giu;
const PROVIDER_KEY_PATTERN = /\b(?:sk|ak|rk|pk)[-_][A-Z0-9._-]{16,}\b/giu;
const ASSIGNED_CREDENTIAL_PATTERN =
  /\b(password|passwd|pwd|api[_-]?key|access[_-]?token|secret|token|jwt)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu;

export function redactQuestionExcerpt(question: string): string {
  // 先做 Unicode 归一化，避免全角字符绕过凭据模式后被原样写库。
  const redacted = question
    .normalize("NFKC")
    .replace(PRIVATE_KEY_PATTERN, CREDENTIAL_MARKER)
    .replace(EMAIL_PATTERN, EMAIL_MARKER)
    .replace(BEARER_PATTERN, CREDENTIAL_MARKER)
    .replace(JWT_PATTERN, CREDENTIAL_MARKER)
    .replace(PROVIDER_KEY_PATTERN, CREDENTIAL_MARKER)
    .replace(
      ASSIGNED_CREDENTIAL_PATTERN,
      (_match, name: string) => `${name}=${CREDENTIAL_MARKER}`,
    )
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 500)
    .trim();

  if (!redacted || redacted === CREDENTIAL_MARKER) return "[内容已脱敏]";
  return redacted;
}
