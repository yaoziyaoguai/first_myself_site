import type { CollectionConfig } from "payload";
import { randomUUID } from "node:crypto";
import { readSeriesArticles, saveSeriesArticles } from "../hooks/seriesArticles";

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
    description: "填写名称和说明 → 选择文章并排序 → 将「前台展示」设为「展示合集」并保存。访客会在文章页看到合集，也能从文章进入整套目录。",
    group: "内容管理",
    preview: (doc) => doc.status === "published" && typeof doc.slug === "string"
      ? `/blog/series/${encodeURIComponent(doc.slug)}` : null,
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
    afterChange: [saveSeriesArticles],
  },
  fields: [
    { name: "title", type: "text", label: "合集名称", required: true },
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
      name: "articles",
      type: "relationship",
      relationTo: "blog",
      hasMany: true,
      maxRows: 100,
      virtual: true,
      maxDepth: 0,
      label: "选择文章与阅读顺序",
      access: { read: ({ req }) => canEdit(req.user?.role) },
      filterOptions: ({ id }) => ({
        or: [
          { series: { exists: false } },
          ...(id ? [{ series: { equals: id } }] : []),
        ],
      }),
      hooks: { afterRead: [readSeriesArticles] },
      admin: {
        allowCreate: false,
        allowEdit: false,
        placeholder: "搜索文章标题，点击加入合集…",
        description: "可以一次选择多篇文章。下方顺序就是读者看到的顺序；移除只解除合集关联，不删除文章。已在其他合集中的文章需先从原合集移除。",
        components: { Field: "@/payload/fields/SeriesArticlesField#SeriesArticlesField" },
      },
    },
    {
      name: "status",
      type: "select",
      label: "前台展示",
      defaultValue: "draft",
      options: [
        { label: "暂不展示（草稿）", value: "draft" },
        { label: "展示合集", value: "published" },
      ],
      admin: { description: "保存后生效。至少加入 1 篇已发布且公开的文章，合集才会出现在文章列表。" },
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
      type: "collapsible",
      label: "访问地址与展示设置（一般无需修改）",
      admin: { initCollapsed: true },
      fields: [
        {
          name: "slug",
          type: "text",
          label: "URL 别名",
          required: true,
          unique: true,
          index: true,
          defaultValue: () => `series-${randomUUID().slice(0, 8)}`,
          admin: { description: "已自动生成。地址为 /blog/series/此别名；公开后修改会改变访问链接。" },
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
