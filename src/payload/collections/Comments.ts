import type { CollectionConfig } from "payload";

const Comments: CollectionConfig = {
  slug: "comments",
  admin: {
    useAsTitle: "content",
    defaultColumns: ["authorName", "content", "targetId", "createdAt"],
  },
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        // 验证内容非空
        if (operation === "create" || operation === "update") {
          const content = data?.content;
          if (!content || typeof content !== "string" || content.trim().length === 0) {
            throw new Error("评论内容不能为空");
          }
          // 验证内容长度
          if (content.length > 1000) {
            throw new Error("评论内容不能超过 1000 字符");
          }
          // 清理内容（去除首尾空格）
          data.content = content.trim();
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: "targetId",
      type: "text",
      label: "目标ID",
      required: true,
      admin: {
        description: "被评论的对象ID（博客文章或项目）",
      },
    },
    {
      name: "targetType",
      type: "select",
      label: "目标类型",
      required: true,
      options: [
        { label: "博客文章", value: "blog" },
        { label: "项目", value: "project" },
      ],
    },
    {
      name: "parentId",
      type: "text",
      label: "父评论ID",
      admin: {
        description: "回复的评论ID，为空表示顶层评论",
      },
    },
    {
      name: "content",
      type: "textarea",
      label: "评论内容",
      required: true,
      maxLength: 1000,
    },
    {
      name: "authorName",
      type: "text",
      label: "昵称",
      defaultValue: "匿名用户",
    },
    {
      name: "authorEmail",
      type: "email",
      label: "邮箱",
    },
    {
      name: "ipHash",
      type: "text",
      label: "IP哈希",
      required: true,
      admin: {
        readOnly: true,
        description: "用于识别匿名用户",
      },
    },
    {
      name: "fingerprint",
      type: "text",
      label: "浏览器指纹",
      admin: {
        readOnly: true,
        description: "用于识别匿名用户",
      },
    },
    {
      name: "isDeleted",
      type: "checkbox",
      label: "已删除",
      defaultValue: false,
      admin: {
        description: "软删除标记",
      },
    },
    {
      name: "deletedBy",
      type: "text",
      label: "删除者",
      admin: {
        readOnly: true,
      },
    },
  ],
  access: {
    // 任何人都可以读取（包括未登录用户）
    read: () => true,
    // 匿名用户可以创建评论
    create: () => true,
    // 只有管理员可以更新（用于软删除）
    update: ({ req }) => req.user?.role === "admin",
    // 只有管理员可以硬删除（一般不直接使用，使用软删除）
    delete: ({ req }) => req.user?.role === "admin",
  },
};

export default Comments;
