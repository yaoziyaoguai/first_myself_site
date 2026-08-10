import type { CollectionConfig } from "payload";

const canViewAnalytics = (role: unknown) =>
  role === "admin" || role === "editor";

const PageViews: CollectionConfig = {
  slug: "page-views",
  labels: {
    singular: "访问记录",
    plural: "访问统计",
  },
  admin: {
    group: "运营",
    useAsTitle: "path",
    description: "站内匿名访问、有效停留时间和最大阅读深度。",
    defaultColumns: [
      "path",
      "title",
      "engagedSeconds",
      "maxScrollDepth",
      "createdAt",
    ],
    components: {
      beforeList: ["@/payload/components/AnalyticsSummary#AnalyticsSummary"],
    },
  },
  fields: [
    {
      name: "sessionId",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { hidden: true },
    },
    {
      name: "visitorHash",
      type: "text",
      required: true,
      index: true,
      admin: { hidden: true },
    },
    {
      name: "path",
      type: "text",
      label: "页面",
      required: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "title",
      type: "text",
      label: "标题",
      admin: { readOnly: true },
    },
    {
      name: "referrerHost",
      type: "text",
      label: "来源网站",
      admin: { readOnly: true },
    },
    {
      name: "engagedSeconds",
      type: "number",
      label: "有效停留（秒）",
      min: 0,
      max: 86_400,
      defaultValue: 0,
      required: true,
      admin: { readOnly: true },
    },
    {
      name: "maxScrollDepth",
      type: "number",
      label: "最大阅读深度（%）",
      min: 0,
      max: 100,
      defaultValue: 0,
      required: true,
      admin: { readOnly: true },
    },
    {
      name: "lastSeenAt",
      type: "date",
      label: "最后活跃时间",
      required: true,
      admin: {
        readOnly: true,
        date: { displayFormat: "yyyy-MM-dd HH:mm:ss" },
      },
    },
  ],
  access: {
    read: ({ req }) => canViewAnalytics(req.user?.role),
    create: () => false,
    update: () => false,
    delete: ({ req }) => req.user?.role === "admin",
  },
};

export default PageViews;
