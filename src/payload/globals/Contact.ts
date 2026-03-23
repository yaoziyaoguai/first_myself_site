import type { GlobalConfig } from "payload";

const Contact: GlobalConfig = {
  slug: "contact",
  admin: {
    description: "联系页面内容配置",
  },
  fields: [
    {
      name: "introText",
      type: "textarea",
      label: "页面介绍文本",
    },
    {
      name: "contactMethods",
      type: "array",
      label: "联系方式",
      fields: [
        {
          name: "title",
          type: "text",
          label: "名称",
          required: true,
        },
        {
          name: "value",
          type: "text",
          label: "显示值",
          required: true,
        },
        {
          name: "description",
          type: "textarea",
          label: "描述",
        },
        {
          name: "href",
          type: "text",
          label: "链接地址",
          required: true,
        },
      ],
    },
    {
      name: "discussionTopics",
      type: "array",
      label: "交流话题",
      fields: [
        {
          name: "label",
          type: "text",
          label: "话题",
          required: true,
        },
      ],
    },
  ],
};

export default Contact;
