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
    // 任何人都可以读取已发布的媒体资源（防止私有文件泄露）
    read: ({ req }) => {
      // 认证用户可以读取所有媒体
      if (req.user) return true;
      // 未认证用户不能在后台列表查看
      return false;
    },
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
