import type { GlobalConfig } from "payload";

const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  admin: {
    description: "全站共享设置（名称、社交链接等）",
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
