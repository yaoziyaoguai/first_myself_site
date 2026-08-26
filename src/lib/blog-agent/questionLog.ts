export type AgentQuestionOutcome =
  | "answered"
  | "insufficient_evidence"
  | "rate_limited"
  | "provider_error";

export type AgentQuestionEvent = {
  queryId: string;
  articleSlug: string;
  questionText: string;
  outcome: AgentQuestionOutcome;
  createdAt: Date;
};

export interface AgentQuestionRecorder {
  record(event: AgentQuestionEvent): Promise<void>;
}

const CREDENTIAL_MARKER = "[凭据已脱敏]";
const EMAIL_MARKER = "[邮箱已脱敏]";
const PRIVATE_KEY_PATTERN =
  /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z0-9]+)* PRIVATE KEY-----/giu;
const EMAIL_PATTERN =
  /\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+\b/giu;
const AUTHORIZATION_PATTERN =
  /\b(?:Authorization\s*:\s*)?(?:Basic|Bearer|Token|ApiKey)\s+[A-Z0-9._~+/=-]{6,}/giu;
const JWT_PATTERN = /\beyJ[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}\b/giu;
const PROVIDER_KEY_PATTERN = /\b(?:sk|ak|rk|pk)[-_][A-Z0-9._-]{16,}\b/giu;
const GITHUB_TOKEN_PATTERN =
  /\b(?:gh[pousr]_[A-Z0-9]{20,}|github_pat_[A-Z0-9_]{20,})\b/giu;
const AWS_ACCESS_KEY_PATTERN = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu;
const ASSIGNED_CREDENTIAL_PATTERN =
  /\b(authorization|[A-Z0-9_-]*(?:password|passwd|pwd|api[_-]?key|access[_-]?key(?:[_-]?(?:id|secret))?|secret[_-]?access[_-]?key|private[_-]?key|secret|token|jwt))["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu;

export function redactAgentQuestion(question: string): string {
  // 先做 Unicode 归一化，避免全角字符绕过凭据模式后被原样写库。
  const redacted = question
    .normalize("NFKC")
    .replace(PRIVATE_KEY_PATTERN, CREDENTIAL_MARKER)
    .replace(EMAIL_PATTERN, EMAIL_MARKER)
    .replace(AUTHORIZATION_PATTERN, CREDENTIAL_MARKER)
    .replace(JWT_PATTERN, CREDENTIAL_MARKER)
    .replace(PROVIDER_KEY_PATTERN, CREDENTIAL_MARKER)
    .replace(GITHUB_TOKEN_PATTERN, CREDENTIAL_MARKER)
    .replace(AWS_ACCESS_KEY_PATTERN, CREDENTIAL_MARKER)
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
