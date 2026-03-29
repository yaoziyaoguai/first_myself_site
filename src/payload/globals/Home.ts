import type { GlobalConfig } from "payload";

const Home: GlobalConfig = {
  slug: "home",
  admin: {
    description: "首页内容配置",
  },
  fields: [
    {
      name: "title",
      type: "text",
      label: "姓名",
      required: true,
    },
    {
      name: "role",
      type: "text",
      label: "职位",
      required: true,
    },
    {
      name: "bio",
      type: "textarea",
      label: "一句话介绍",
      required: true,
    },
    {
      name: "directions",
      type: "array",
      label: "方向标签",
      fields: [
        {
          name: "label",
          type: "text",
          label: "标签",
        },
      ],
    },
    {
      name: "capabilities",
      type: "array",
      label: "能力卡片",
      fields: [
        {
          name: "title",
          type: "text",
          label: "能力名称",
          required: true,
        },
        {
          name: "description",
          type: "textarea",
          label: "能力描述",
          required: true,
        },
      ],
    },
  ],
  access: {
    read: () => true,
    update: ({ req }) => {
      if (!req.user) return false;
      return req.user.role === "admin" || req.user.role === "editor";
    },
  },
};

export default Home;
