import type { GlobalConfig } from "payload";
import { siteDefaults } from "@/content/siteDefaults";

const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  label: "全站设置",
  admin: {
    description: "全站共享设置（名称、社交链接等）",
    group: "页面内容",
  },
  fields: [
    {
      name: "name",
      type: "text",
      label: "姓名",
      required: true,
    },
    {
      name: "nameShort",
      type: "text",
      label: "简称",
    },
    {
      name: "bioShort",
      type: "textarea",
      label: "简短介绍（用于 Footer）",
    },
    {
      name: "email",
      type: "email",
      label: "公开邮箱",
      defaultValue: siteDefaults.identity.email,
      admin: {
        description: "显示在联系页和页脚，可在这里随时修改。",
      },
    },
    {
      name: "socialLinks",
      type: "array",
      label: "社交链接",
      fields: [
        {
          name: "href",
          type: "text",
          label: "链接地址",
          required: true,
        },
        {
          name: "label",
          type: "text",
          label: "显示名称",
          required: true,
        },
      ],
    },
    {
      name: "contentVersion",
      type: "number",
      defaultValue: 0,
      hidden: true,
    },
  ],
  access: {
    read: () => true,
    update: ({ req }) => {
      if (!req.user) return false;
      return req.user.role === "admin" || req.user.role === "editor";
    },
  },
};

export default SiteSettings;
