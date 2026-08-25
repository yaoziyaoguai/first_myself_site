import { describe, expect, it } from "vitest";
import { redactQuestionExcerpt } from "@/lib/blog-agent/unansweredQuestions";

describe("redactQuestionExcerpt", () => {
  it("removes common credentials and personal email before persistence", () => {
    const result = redactQuestionExcerpt(`
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
    expect(result).toContain("[凭据已脱敏]");
    expect(result).not.toContain("wangjinkun333@gmail.com");
    expect(result).not.toContain("super-secret-bearer-value");
    expect(result).not.toContain("sk-abcdefghijklmnopqrstuvwxyz012345");
    expect(result).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(result).not.toContain("correct-horse-battery-staple");
    expect(result).not.toContain("very-private-material");
  });

  it("normalizes full-width credential text before applying redaction", () => {
    const result = redactQuestionExcerpt(
      "这个值安全吗：ｓｋ－abcdefghijklmnopqrstuvwxyz012345",
    );

    expect(result).toBe("这个值安全吗:[凭据已脱敏]");
  });

  it("caps the stored excerpt at 500 characters", () => {
    const result = redactQuestionExcerpt(`问题：${"内".repeat(600)}`);

    expect(result).toHaveLength(500);
    expect(result.startsWith("问题:")).toBe(true);
  });

  it("uses a fixed placeholder when no safe visible text remains", () => {
    expect(
      redactQuestionExcerpt("sk-abcdefghijklmnopqrstuvwxyz012345"),
    ).toBe("[内容已脱敏]");
  });
});
