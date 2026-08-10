import type { ContactMethod } from "@/content/siteDefaults";

type FooterLink = {
  href: string;
  label: string;
};

function isEmailLink(href: string): boolean {
  return href.trim().toLowerCase().startsWith("mailto:");
}

function replaceEmailLink<T extends { href: string }>(
  items: readonly T[],
  emailItem: T,
): T[] {
  return [emailItem, ...items.filter((item) => !isEmailLink(item.href))];
}

export function buildContactMethods(
  email: string,
  methods: readonly ContactMethod[],
): ContactMethod[] {
  return replaceEmailLink(methods, {
    title: "Email",
    value: email,
    description: "可以通过邮件联系我。",
    href: `mailto:${email}`,
  });
}

export function buildFooterLinks(
  email: string,
  links: readonly FooterLink[],
): FooterLink[] {
  return replaceEmailLink(links, {
    href: `mailto:${email}`,
    label: "Email",
  });
}
