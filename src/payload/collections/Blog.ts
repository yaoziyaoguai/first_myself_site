import type { CollectionConfig } from "payload";

const Blog: CollectionConfig = {
  slug: "blog",
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
      ({ data, operation, originalDoc }) => {
        if (operation === "create") {
          const hasContent =
            !!data?.content && JSON.stringify(data.content) !== "{}";
          const hasMarkdown =
            typeof data?.contentMarkdown === "string" &&
            data.contentMarkdown.trim().length > 0;

          if (!hasContent && !hasMarkdown) {
            throw new Error("请填写『文章内容 (富文本)』或『文章内容 (Markdown)』至少一项");
          }
        }

        if (operation === "update" && originalDoc) {
          const finalContent =
            data?.content !== undefined ? data.content : originalDoc.content;

          const finalMarkdown =
            data?.contentMarkdown !== undefined
              ? data.contentMarkdown
              : originalDoc.contentMarkdown;

          const hasContent =
            !!finalContent && JSON.stringify(finalContent) !== "{}";

          const hasMarkdown =
            typeof finalMarkdown === "string" && finalMarkdown.trim().length > 0;

          if (!hasContent && !hasMarkdown) {
            throw new Error("请填写『文章内容 (富文本)』或『文章内容 (Markdown)』至少一项");
          }
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
      label: "文章内容 (富文本)",
      required: false,
    },
    {
      name: "contentMarkdown",
      type: "textarea",
      label: "文章内容 (Markdown)",
      required: false,
      admin: {
        description: "使用 Markdown 格式编写文章。如果填写了此字段，将优先使用 Markdown 渲染。支持标准 Markdown 语法和表格、任务列表等 GFM 扩展。",
        components: {
          Field: "@/payload/fields/MarkdownPreviewField#MarkdownPreviewField"
        }
      },
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
    {
      name: "visibility",
      type: "select",
      label: "可见性",
      defaultValue: "public",
      options: [
        { label: "公开", value: "public" },
        { label: "仅自己可见", value: "private" },
      ],
    },
  ],
  access: {
    // 未登录用户只能读取已发布且公开的文章；管理员/编辑可以读取全部
    read: ({ req }): boolean | { status: { equals: string }; visibility: { equals: string } } => {
      if (!req.user) {
        // 未认证用户只能看已发布且公开的文章
        return {
          status: { equals: "published" },
          visibility: { equals: "public" },
        };
      }
      // 认证用户（编辑/管理员）可以看所有文章
      if (req.user.role === "admin" || req.user.role === "editor") {
        return true;
      }
      // 其他认证用户不能看
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

export default Blog;
