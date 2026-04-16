import type { CollectionConfig } from "payload";

const Likes: CollectionConfig = {
  slug: "likes",
  admin: {
    useAsTitle: "targetId",
    defaultColumns: ["targetType", "targetId", "createdAt"],
  },
  fields: [
    {
      name: "targetId",
      type: "text",
      label: "目标ID",
      required: true,
      admin: {
        description: "被点赞的对象ID",
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
      name: "ipHash",
      type: "text",
      label: "IP哈希",
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: "fingerprint",
      type: "text",
      label: "浏览器指纹",
      required: true,
      admin: {
        readOnly: true,
      },
    },
  ],
  // 复合唯一索引：防止同一 IP + 指纹重复点赞
  indexes: [
    {
      fields: ["targetId", "targetType", "ipHash", "fingerprint"],
      unique: true,
    },
  ],
  access: {
    // 任何人都可以读取点赞数
    read: () => true,
    // 匿名用户可以创建点赞
    create: () => true,
    // 不允许更新点赞（创建后不可修改）
    update: () => false,
    // 不允许删除点赞（简化设计，不支持取消点赞）
    delete: () => false,
  },
};

export default Likes;
