import type { CollectionConfig } from "payload";

const TrendingTopics: CollectionConfig = {
  slug: "trending-topics",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "category", "date", "status"],
    listSearchableFields: ["title", "category"],
    description: "管理每日热点趋势，记录各领域热门话题。",
  },
  fields: [
    {
      name: "title",
      type: "text",
      label: "标题",
      required: true,
    },
    {
      name: "description",
      type: "textarea",
      label: "描述",
      required: true,
    },
    {
      name: "category",
      type: "select",
      label: "分类",
      required: true,
      defaultValue: "tech",
      options: [
        { label: "科技", value: "tech" },
        { label: "财经", value: "finance" },
        { label: "AI", value: "ai" },
        { label: "数据工程", value: "data" },
        { label: "社会", value: "society" },
        { label: "其他", value: "other" },
      ],
    },
    {
      name: "date",
      type: "date",
      label: "日期",
      required: true,
      admin: {
        date: {
          pickerAppearance: "dayOnly",
          displayFormat: "yyyy-MM-dd",
        },
      },
    },
    {
      name: "hotScore",
      type: "number",
      label: "热度分",
      defaultValue: 0,
      admin: {
        description: "数值越高代表越热门（0-100）",
      },
    },
    {
      name: "sourceName",
      type: "text",
      label: "来源名称",
    },
    {
      name: "sourceUrl",
      type: "text",
      label: "来源链接",
    },
    {
      name: "tags",
      type: "array",
      label: "标签",
      fields: [
        {
          name: "tag",
          type: "text",
          label: "标签名",
        },
      ],
    },
    {
      name: "status",
      type: "select",
      label: "状态",
      defaultValue: "published",
      options: [
        { label: "已发布", value: "published" },
        { label: "草稿", value: "draft" },
      ],
    },
  ],
  access: {
    read: () => true,
    create: ({ req }) => {
      if (!req.user) return false;
      return req.user.role === "admin" || req.user.role === "editor";
    },
    update: ({ req }) => {
      if (!req.user) return false;
      return req.user.role === "admin" || req.user.role === "editor";
    },
    delete: ({ req }) => req.user?.role === "admin",
  },
};

export default TrendingTopics;
