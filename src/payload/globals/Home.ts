import type { GlobalConfig } from "payload";

const Home: GlobalConfig = {
  slug: "home",
  label: "首页与最近学习",
  admin: {
    description: "管理首页介绍、方向标签和“最近在学习”模块。",
    group: "页面内容",
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
      label: "最近在学习",
      admin: {
        description: "这些条目会显示在首页“最近在学习”区域。",
      },
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
