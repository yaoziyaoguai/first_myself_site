import type { CollectionConfig } from "payload";

const Posts: CollectionConfig = {
  slug: "posts",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "status", "publishedDate"],
    listSearchableFields: ["title", "slug"],
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data?.slug && typeof data.slug === "string") {
          data.slug = data.slug.trim();
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: "title",
      type: "text",
      label: "标题",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      label: "URL 别名",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "publishedDate",
      type: "date",
      label: "发布日期",
      required: true,
      admin: {
        date: {
          pickerAppearance: "dayOnly",
          displayFormat: "yyyy-MM-dd",
        },
      },
    },
    {
      name: "excerpt",
      type: "textarea",
      label: "摘要",
      required: true,
    },
    {
      name: "coverImage",
      type: "upload",
      relationTo: "media",
      label: "封面图",
      required: false,
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
      name: "readingTime",
      type: "text",
      label: "阅读时长",
    },
    {
      name: "content",
      type: "richText",
      label: "文章内容",
      required: true,
    },
    {
      name: "attachments",
      type: "relationship",
      relationTo: "media",
      label: "附件",
      hasMany: true,
      required: false,
    },
    {
      name: "status",
      type: "select",
      label: "状态",
      defaultValue: "draft",
      options: [
        { label: "草稿", value: "draft" },
        { label: "已发布", value: "published" },
      ],
    },
  ],
  access: {
    // 任何人都可以读取已发布的文章，认证用户可以读取自己的草稿
    read: ({ req }) => {
      if (!req.user) {
        // 未认证用户只能看已发布的文章
        return {
          status: {
            equals: "published",
          },
        };
      }
      // 认证用户（编辑/管理员）可以看所有文章
      if (req.user.role === "admin" || req.user.role === "editor") {
        return true;
      }
      // 普通用户不能在后台管理中看文章列表
      return false;
    },
    // 只有管理员和编辑可以创建
    create: ({ req }) => {
      if (!req.user) return false;
      return req.user.role === "admin" || req.user.role === "editor";
    },
    // 只有管理员和编辑可以更新
    update: ({ req }) => {
      if (!req.user) return false;
      return req.user.role === "admin" || req.user.role === "editor";
    },
    // 只有管理员可以删除
    delete: ({ req }) => req.user?.role === "admin",
  },
};

export default Posts;
