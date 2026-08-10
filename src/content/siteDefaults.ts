export type Direction = { label: string };
export type ContentCard = { title: string; description: string };
export type TechGroup = { category: string; items: string };
export type ContactMethod = {
  title: string;
  value: string;
  description?: string;
  href: string;
};

export type ProjectSummary = {
  id: string;
  title: string;
  slug: string;
  role: string;
  period: string;
  description: string;
  href: string;
  tags: { tag: string }[];
  highlights: { text: string }[];
};

export const SITE_URL = "https://wangjinkun333.me";

export const siteDefaults = {
  identity: {
    name: "Jinkun Wang",
    nameShort: "Jinkun",
    email: "wangjinkun333@gmail.com",
    role: "数据工程师，正在学习 AI 评测与 Agent 系统。",
    bio: "记录从数据工程出发，学习 AI 评测、Agent 工程与可靠系统构建的过程。",
  },
  home: {
    directions: [
      { label: "数据工程" },
      { label: "AI 评测" },
      { label: "Agent 系统" },
    ] satisfies Direction[],
    learningAreas: [
      {
        title: "可靠的数据基础",
        description: "继续打磨数据建模、数据质量与可观测性，让 AI 实验建立在可信的数据之上。",
      },
      {
        title: "可复现的评测",
        description: "学习把主观体验变成可重复的测试、数据集和反馈循环。",
      },
      {
        title: "可控的 Agent",
        description: "通过小项目理解上下文、工具、记忆、权限与失败恢复之间的关系。",
      },
    ] satisfies ContentCard[],
  },
  about: {
    introText:
      "我主要从事数据工程相关工作，也在通过写作和小项目学习 AI 评测与 Agent 系统。这个网站用来记录其中的实践、困惑和阶段性理解。",
    workDirections: [
      {
        title: "数据工程",
        description: "关注数据建模、任务编排、数据质量与稳定交付。",
      },
      {
        title: "AI 评测",
        description: "学习构建可复现的用例、指标和回归检查，让改进有证据可循。",
      },
      {
        title: "Agent 工程",
        description: "探索工具调用、上下文管理、记忆与安全边界等工程问题。",
      },
    ] satisfies ContentCard[],
    techStack: [
      { category: "数据", items: "SQL, PostgreSQL, 数据建模" },
      { category: "应用", items: "TypeScript, Python, Next.js" },
      { category: "AI 实践", items: "Evaluation, Agents, Context Engineering" },
    ] satisfies TechGroup[],
    focusAreas: [
      {
        title: "结果如何被验证",
        description: "不只关注模型能否给出答案，也关注答案是否稳定、可追踪、可复现。",
      },
      {
        title: "系统如何安全失败",
        description: "关注权限、超时、重试、检查点和人工介入如何共同降低失控风险。",
      },
    ] satisfies ContentCard[],
  },
  projects: [
    {
      id: "default-mindforge",
      title: "MindForge",
      slug: "mindforge",
      role: "个人学习项目",
      period: "持续迭代",
      description:
        "围绕 Agent 的上下文、记忆、工具与评测搭建实验场，用小步迭代理解可靠 AI 系统的工程边界。",
      href: "https://github.com/yaoziyaoguai/mindforge",
      tags: [{ tag: "Agent" }, { tag: "Evaluation" }, { tag: "Harness" }],
      highlights: [
        { text: "用真实实验记录设计取舍和失败原因" },
        { text: "逐步补充评测、检查点与安全约束" },
      ],
    },
    {
      id: "default-portfolio",
      title: "个人网站",
      slug: "personal-site",
      role: "独立开发",
      period: "持续维护",
      description:
        "使用 Next.js、Payload CMS 与 PostgreSQL 搭建内容网站，并通过 GitHub Actions 部署到阿里云。",
      href: "https://github.com/yaoziyaoguai/first_myself_site",
      tags: [{ tag: "Next.js" }, { tag: "Payload CMS" }, { tag: "PostgreSQL" }],
      highlights: [
        { text: "内容管理、公开页面与部署链路保持在同一仓库" },
        { text: "持续补齐测试、安全边界与生产可观测性" },
      ],
    },
  ] satisfies ProjectSummary[],
  contact: {
    introText: "如果你也在学习数据、AI 评测或 Agent 工程，欢迎通过邮箱或 GitHub 联系我。",
    methods: [
      {
        title: "GitHub",
        value: "@yaoziyaoguai",
        description: "查看公开项目、文章相关代码与学习记录。",
        href: "https://github.com/yaoziyaoguai",
      },
    ] satisfies ContactMethod[],
    topics: [
      { label: "数据工程与数据质量" },
      { label: "AI 评测与回归测试" },
      { label: "Agent 工程实践" },
    ] satisfies Direction[],
  },
  blog: {
    description: "记录数据工程、AI 评测、Agent 与 Harness 工程的学习和实践。",
    emptyMessage: "文章还在整理中，可以稍后再来看看。",
  },
} as const;
