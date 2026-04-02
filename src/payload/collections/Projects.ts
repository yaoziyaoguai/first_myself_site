import type { CollectionConfig } from "payload";

const Projects: CollectionConfig = {
  slug: "projects",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "role", "period"],
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
      label: "项目名称",
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
      name: "description",
      type: "textarea",
      label: "项目描述",
      required: true,
    },
    {
      name: "role",
      type: "text",
      label: "担任角色",
      required: true,
    },
    {
      name: "period",
      type: "text",
      label: "时间段",
      required: true,
    },
    {
      name: "tags",
      type: "array",
      label: "技术标签",
      fields: [
        {
          name: "tag",
          type: "text",
          label: "标签名",
        },
      ],
    },
    {
      name: "highlights",
      type: "array",
      label: "项目亮点",
      fields: [
        {
          name: "text",
          type: "text",
          label: "亮点内容",
        },
      ],
    },
    {
      name: "sortOrder",
      type: "number",
      label: "排序权重",
      defaultValue: 0,
      admin: {
        description: "数字越小越靠前",
      },
    },
  ],
  access: {
    // 任何人都可以读取项目（公开内容）
    read: () => true,
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

export default Projects;
