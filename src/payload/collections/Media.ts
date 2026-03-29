import type { CollectionConfig } from "payload";

const Media: CollectionConfig = {
  slug: "media",
  admin: {
    useAsTitle: "filename",
    defaultColumns: ["filename", "mimeType", "createdAt"],
  },
  upload: true,
  fields: [
    {
      name: "alt",
      type: "text",
      label: "替代文本",
      required: false,
    },
    {
      name: "description",
      type: "textarea",
      label: "描述",
      required: false,
    },
  ],
  access: {
    // 允许读取媒体列表（用于 Admin relationship 字段加载）
    read: () => true,
    // 只有管理员和编辑可以上传
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

export default Media;
