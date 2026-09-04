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
      id: "default-portfolio",
      title: "个人网站",
      slug: "personal-site",
      role: "全栈内容系统",
      period: "2026.09 · 持续维护",
      description:
        "使用 Next.js、Payload CMS 与 PostgreSQL 搭建可配置的技术博客，并通过 GitHub Actions 持续部署到阿里云。",
      href: "https://github.com/yaoziyaoguai/first_myself_site",
      tags: [{ tag: "Next.js" }, { tag: "Payload CMS" }, { tag: "PostgreSQL" }],
      highlights: [
        { text: "文章、项目、统计和单篇文章问答由同一后台管理" },
        { text: "从 Pull Request、自动测试到阿里云部署形成完整发布链路" },
      ],
    },
    {
      id: "default-gpt-oracle-web",
      title: "GPT Oracle Web",
      slug: "gpt-oracle-web",
      role: "Codex Skill 与浏览器自动化",
      period: "2026.09 · 活跃开发",
      description:
        "把复杂规划和代码审查交给已登录的 ChatGPT 网页端，再由当前 Codex 负责实现与验证的可安装工作流。",
      href: "https://github.com/yaoziyaoguai/gpt_oracle_web",
      tags: [{ tag: "Codex Skill" }, { tag: "CDP" }, { tag: "Fail Closed" }],
      highlights: [
        { text: "验证网页实际显示的推理档位和已提交消息，不把请求参数当作成功证据" },
        { text: "按独立 session 管理 Chrome 身份、恢复和临时 Profile 清理" },
      ],
    },
    {
      id: "default-video-factory",
      title: "VideoFactory",
      slug: "video-factory",
      role: "本地优先短视频 Creative OS",
      period: "2026.09 · 活跃开发",
      description:
        "把选题、Production Brief、逐镜素材、配音渲染、审片返修和发布包组织成可恢复、可审计的单人创作链路。",
      href: "https://github.com/yaoziyaoguai/video-factory",
      tags: [{ tag: "TypeScript" }, { tag: "Fastify" }, { tag: "FFmpeg" }],
      highlights: [
        { text: "React Studio 管理工作流、审批、成本和 artifact，Python 负责媒体执行" },
        { text: "付费素材逐镜报价并由人工确认，失败节点明确停止而不是伪装成片" },
      ],
    },
    {
      id: "default-my-first-agent",
      title: "My First Agent",
      slug: "my-first-agent",
      role: "本地优先 Agent Runtime",
      period: "2026.08 · 活跃开发",
      description:
        "从当前目录工作的日常 Agent，围绕上下文、工具审批、持久化状态、失败恢复和来源证据构建一条受治理的执行路径。",
      href: "https://github.com/yaoziyaoguai/my-first-agent",
      tags: [{ tag: "Python" }, { tag: "Agent Runtime" }, { tag: "Safety" }],
      highlights: [
        { text: "同一自然语言入口覆盖回答、文件任务、受控 Web 和结构化本机行动" },
        { text: "只有 durable evidence 满足验收标准时才显示任务完成" },
      ],
    },
    {
      id: "default-mindforge",
      title: "MindForge",
      slug: "mindforge",
      role: "知识工作流学习项目",
      period: "2026.06 · 阶段性归档",
      description:
        "把本地资料转成待审知识卡片，经人工批准后进入 Library、BM25 Recall 和 Topic View 的个人知识加工实验。",
      href: "https://github.com/yaoziyaoguai/mindforge",
      tags: [{ tag: "Python" }, { tag: "Knowledge Workflow" }, { tag: "BM25" }],
      highlights: [
        { text: "AI 只生成草稿，正式知识必须人工显式批准" },
        { text: "项目已暂停推进，保留为 vibe coding 学习和复盘样本" },
      ],
    },
    {
      id: "default-vehicle-memory-benchmark",
      title: "Vehicle Memory Benchmark",
      slug: "vehicle-memory-benchmark",
      role: "车载 AI 记忆离线诊断",
      period: "2026.06 · 阶段性实践",
      description:
        "面向自然语言记忆系统的离线评测工具，用标准化 predictions 快照定位抽取、更新、删除、召回和隐私边界问题。",
      href: "https://github.com/yaoziyaoguai/vehicle_memory_benchmark",
      tags: [{ tag: "Python" }, { tag: "Memory" }, { tag: "Evaluation" }],
      highlights: [
        { text: "评测器不直连目标系统，只消费可复现、可审计的 predictions.jsonl" },
        { text: "覆盖 210 个 case，并区分真实零分与本轮未覆盖的 N/A" },
      ],
    },
    {
      id: "default-agent-tool-harness",
      title: "Agent Tool Harness",
      slug: "agent-tool-harness",
      role: "Agent 工具调用评测",
      period: "2026.05 · 阶段性实践",
      description:
        "消费已有 trace 和评测结果，以确定性规则检查工具调用、任务结果、回归变化、上下文浪费和工具组合质量。",
      href: "https://github.com/yaoziyaoguai/agent-tool-harness",
      tags: [{ tag: "Python" }, { tag: "Tool Use" }, { tag: "Evaluation" }],
      highlights: [
        { text: "默认不运行目标 Agent、不调用真实 LLM，也不自动修改工具" },
        { text: "从单条 trace 检查延伸到 suite、回归对比和工具组合评审" },
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
