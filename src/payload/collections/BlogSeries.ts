import type { CollectionConfig } from "payload";

const canEdit = (role: unknown) => role === "admin" || role === "editor";

const BlogSeries: CollectionConfig = {
  slug: "blog-series",
  labels: {
    singular: "文章合集",
    plural: "文章合集",
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "progress", "featured", "status", "sortOrder"],
    description: "把有明确阅读顺序的文章组织成专题；普通标签仍用于横向检索。",
    group: "内容管理",
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
    { name: "title", type: "text", label: "合集名称", required: true },
    {
      name: "slug",
      type: "text",
      label: "URL 别名",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "description",
      type: "textarea",
      label: "合集说明",
      required: true,
      admin: {
        description: "说明这个合集解决什么问题，以及读者为什么应该按顺序阅读。",
      },
    },
    {
      name: "progress",
      type: "select",
      label: "更新状态",
      defaultValue: "ongoing",
      options: [
        { label: "持续更新", value: "ongoing" },
        { label: "已完结", value: "completed" },
      ],
    },
    {
      name: "featured",
      type: "checkbox",
      label: "在文章页重点展示",
      defaultValue: false,
    },
    {
      name: "sortOrder",
      type: "number",
      label: "展示顺序",
      defaultValue: 0,
      admin: { description: "数字越小越靠前；重点展示的合集始终优先。" },
    },
    {
      name: "status",
      type: "select",
      label: "发布状态",
      defaultValue: "draft",
      options: [
        { label: "草稿", value: "draft" },
        { label: "已发布", value: "published" },
      ],
    },
  ],
  access: {
    read: ({ req }) => {
      if (!req.user) return { status: { equals: "published" } };
      return canEdit(req.user.role);
    },
    create: ({ req }) => canEdit(req.user?.role),
    update: ({ req }) => canEdit(req.user?.role),
    delete: ({ req }) => req.user?.role === "admin",
  },
};

export default BlogSeries;
