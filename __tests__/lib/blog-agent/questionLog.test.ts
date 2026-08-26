import { describe, expect, it } from "vitest";
import { redactAgentQuestion } from "@/lib/blog-agent/questionLog";

describe("redactAgentQuestion", () => {
  it("removes common credentials and personal email before persistence", () => {
    const result = redactAgentQuestion(`
      请分析 wangjinkun333@gmail.com 的配置。
      Authorization: Bearer super-secret-bearer-value
      api_key=sk-abcdefghijklmnopqrstuvwxyz012345
      jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signaturevalue
      password = correct-horse-battery-staple
      -----BEGIN PRIVATE KEY-----
      very-private-material
      -----END PRIVATE KEY-----
    `);

    expect(result).toContain("[邮箱已脱敏]");
    expect(result).toMatch(/\[(?:凭据|内容)已脱敏\]/u);
    expect(result).not.toContain("wangjinkun333@gmail.com");
    expect(result).not.toContain("super-secret-bearer-value");
    expect(result).not.toContain("sk-abcdefghijklmnopqrstuvwxyz012345");
    expect(result).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(result).not.toContain("correct-horse-battery-staple");
    expect(result).not.toContain("very-private-material");
  });

  it.each([
    ["Authorization: Basic dXNlcjpwYXNzd29yZA==", "dXNlcjpwYXNzd29yZA=="],
    ["Authorization: Token abcdefghijklmnopqrstuvwxyz", "abcdefghijklmnopqrstuvwxyz"],
    ["Authorization: ApiKey abcdefghijklmnopqrstuvwxyz", "abcdefghijklmnopqrstuvwxyz"],
    ["GitHub token ghp_abcdefghijklmnopqrstuvwxyz123456", "ghp_abcdefghijklmnopqrstuvwxyz123456"],
    [
      "GitHub fine-grained token github_pat_11ABCDEFG_abcdefghijklmnopqrstuvwxyz",
      "github_pat_11ABCDEFG_abcdefghijklmnopqrstuvwxyz",
    ],
    ["AWS access key AKIAIOSFODNN7EXAMPLE", "AKIAIOSFODNN7EXAMPLE"],
    ['{"clientSecret":"super-secret-client-value"}', "super-secret-client-value"],
    ['{"database_password":"correct-horse-battery-staple"}', "correct-horse-battery-staple"],
    ['Authorization: "Bearer quoted-secret-bearer-value"', "quoted-secret-bearer-value"],
    ['refresh_token="refresh-token-secret-value"', "refresh-token-secret-value"],
    ['AWS_SECRET_ACCESS_KEY="aws-secret-access-value"', "aws-secret-access-value"],
    ['WEBHOOK_SECRET="webhook-secret-value"', "webhook-secret-value"],
    ['PRIVATE_KEY="private-key-secret-value"', "private-key-secret-value"],
    ['DASHSCOPE_API_KEY="dashscope-secret-value"', "dashscope-secret-value"],
  ])("redacts supported credential format: %s", (question, secret) => {
    const result = redactAgentQuestion(question);

    expect(result).toMatch(/\[(?:凭据|内容)已脱敏\]/u);
    expect(result).not.toContain(secret);
  });

  it("normalizes full-width credential text before applying redaction", () => {
    const result = redactAgentQuestion(
      "这个值安全吗：ｓｋ－abcdefghijklmnopqrstuvwxyz012345",
    );

    expect(result).toBe("这个值安全吗:[凭据已脱敏]");
  });

  it("caps the stored question at 500 characters", () => {
    const result = redactAgentQuestion(`问题：${"内".repeat(600)}`);

    expect(result).toHaveLength(500);
    expect(result.startsWith("问题:")).toBe(true);
  });

  it("uses a fixed placeholder when no safe visible text remains", () => {
    expect(
      redactAgentQuestion("sk-abcdefghijklmnopqrstuvwxyz012345"),
    ).toBe("[内容已脱敏]");
  });
});
