import type { GlobalConfig } from "payload";

const About: GlobalConfig = {
  slug: "about",
  admin: {
    description: "关于页面内容配置",
  },
  fields: [
    {
      name: "introText",
      type: "textarea",
      label: "自我介绍",
      required: true,
    },
    {
      name: "workDirections",
      type: "array",
      label: "工作方向",
      fields: [
        {
          name: "title",
          type: "text",
          label: "方向名称",
          required: true,
        },
        {
          name: "description",
          type: "textarea",
          label: "方向描述",
          required: true,
        },
      ],
    },
    {
      name: "techStack",
      type: "array",
      label: "技术栈",
      fields: [
        {
          name: "category",
          type: "text",
          label: "分类名称",
          required: true,
        },
        {
          name: "items",
          type: "text",
          label: "技术列表（逗号分隔）",
          required: true,
        },
      ],
    },
    {
      name: "focusAreas",
      type: "array",
      label: "关注领域",
      fields: [
        {
          name: "title",
          type: "text",
          label: "领域名称",
          required: true,
        },
        {
          name: "description",
          type: "textarea",
          label: "领域描述",
          required: true,
        },
      ],
    },
  ],
};

export default About;
