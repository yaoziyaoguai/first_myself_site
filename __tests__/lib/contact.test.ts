import { describe, expect, it } from "vitest";
import { buildContactMethods, buildFooterLinks } from "@/lib/contact";

describe("public contact helpers", () => {
  const email = "wangjinkun333@gmail.com";

  it("adds the public email to contact methods", () => {
    expect(
      buildContactMethods(email, [
        {
          title: "GitHub",
          value: "@yaoziyaoguai",
          href: "https://github.com/yaoziyaoguai",
        },
      ]),
    ).toEqual([
      {
        title: "Email",
        value: email,
        description: "可以通过邮件联系我。",
        href: `mailto:${email}`,
      },
      {
        title: "GitHub",
        value: "@yaoziyaoguai",
        href: "https://github.com/yaoziyaoguai",
      },
    ]);
  });

  it("replaces an existing mail link instead of rendering duplicate email entries", () => {
    expect(
      buildContactMethods(email, [
        {
          title: "旧邮箱",
          value: "old@example.com",
          href: "mailto:old@example.com",
        },
      ]),
    ).toHaveLength(1);

    expect(
      buildFooterLinks(email, [
        { href: "mailto:old@example.com", label: "旧邮箱" },
        { href: "https://github.com/yaoziyaoguai", label: "GitHub" },
      ]),
    ).toEqual([
      { href: `mailto:${email}`, label: "Email" },
      { href: "https://github.com/yaoziyaoguai", label: "GitHub" },
    ]);
  });
});
