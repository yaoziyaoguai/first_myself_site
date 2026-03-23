import { getPayloadAPI } from "@/lib/payload";
import { NextResponse } from "next/server";

/**
 * GET /api/seed — 一次性数据填充接口
 * 需要环境变量: ADMIN_SECRET_TOKEN (安全验证)
 * 不允许在生产环境使用
 */
export async function GET(request: Request) {
  // 生产环境绝对禁止
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
  }

  // 验证管理员密钥
  const adminToken = request.headers.get("Authorization");
  const expectedToken = `Bearer ${process.env.ADMIN_SECRET_TOKEN}`;
  if (!adminToken || adminToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized: missing or invalid token" }, { status: 401 });
  }

  const payload = await getPayloadAPI();
  const results: string[] = [];

  try {
    // === Globals ===

    await payload.updateGlobal({
      slug: "home",
      data: {
        title: "Jinkun Wang",
        role: "Senior Data Engineer / Data Warehouse Engineer",
        bio: "数据仓库工程师，关注数据建模、指标体系、Agent 数据与智能座舱数据分析。",
        directions: [
          { label: "数据建模" },
          { label: "指标体系" },
          { label: "Agent 数据" },
          { label: "智能座舱" },
        ],
        capabilities: [
          {
            title: "数仓建模与数据分层",
            description: "设计合理的数据模型和分层架构，让数据可追溯、可复用、易理解。",
          },
          {
            title: "SQL / Spark / Doris / ClickHouse",
            description: "熟练掌握数据处理核心技术栈，高效完成数据开发与性能优化。",
          },
          {
            title: "AI Agent 数据设计与可观测性",
            description: "为 AI Agent 构建数据链路，设计数据追踪与可观测性方案。",
          },
        ],
      },
    });
    results.push("✓ Home global seeded");

    await payload.updateGlobal({
      slug: "site-settings",
      data: {
        name: "Jinkun Wang",
        nameShort: "JK",
        bioShort: "数据仓库工程师 | 关注数据建模、指标体系、Agent 数据",
        socialLinks: [
          { href: "https://github.com/yourusername", label: "GitHub" },
          { href: "https://linkedin.com/in/yourusername", label: "LinkedIn" },
        ],
      },
    });
    results.push("✓ Site Settings global seeded");

    await payload.updateGlobal({
      slug: "about",
      data: {
        introText: "我相信好的数据架构应该是简洁、可维护的。技术选型追求合适而非最新，代码实现追求清晰而非炫技。",
        workDirections: [
          { title: "数据建模", description: "设计合理的数据模型和分层架构，让数据可追溯、可复用、易理解。" },
          { title: "指标体系", description: "构建业务指标体系，将数据转化为可衡量的业务洞察。" },
          { title: "Agent 数据", description: "为 AI Agent 设计数据链路，构建数据追踪与可观测性方案。" },
          { title: "智能座舱", description: "车联网场景下的数据分析与应用，支持智能座舱产品迭代。" },
        ],
        techStack: [
          { category: "数据处理", items: "SQL, Spark, Python, Flink" },
          { category: "数据仓库", items: "Doris, ClickHouse, Hive" },
          { category: "数据查询", items: "Presto, Trino" },
          { category: "数据流", items: "Kafka" },
          { category: "数据开发", items: "Airflow, dbt" },
          { category: "数据能力", items: "埋点, 指标体系, 数据治理, Agent Observability" },
        ],
        focusAreas: [
          { title: "数据质量与治理", description: "如何建立数据质量体系，让数据可信、可用。" },
          { title: "数据模型设计", description: "如何设计可扩展、易维护的数据模型。" },
          { title: "AI 时代的数据工程", description: "Agent 数据如何设计、追踪、评估和优化。" },
          { title: "实时与离线融合", description: "如何平衡实时性与成本，构建高效的数据链路。" },
        ],
      },
    });
    results.push("✓ About global seeded");

    await payload.updateGlobal({
      slug: "contact",
      data: {
        introText: "如果你有任何问题、建议或合作意向，欢迎通过以下方式联系我。我会在 1-2 个工作日内回复。",
        contactMethods: [
          { title: "电子邮件", value: "your.email@example.com", description: "工作相关咨询、合作邀请", href: "mailto:your.email@example.com" },
          { title: "GitHub", value: "github.com/yourusername", description: "开源项目、代码示例", href: "https://github.com/yourusername" },
          { title: "LinkedIn", value: "linkedin.com/in/yourusername", description: "职业社交、行业交流", href: "https://linkedin.com/in/yourusername" },
        ],
        discussionTopics: [
          { label: "数据建模" },
          { label: "指标体系" },
          { label: "Agent 数据" },
          { label: "智能座舱" },
          { label: "职业发展交流" },
        ],
      },
    });
    results.push("✓ Contact global seeded");

    // === Collections ===

    const existingProjects = await payload.find({ collection: "projects", limit: 1 });
    if (existingProjects.totalDocs === 0) {
      const projectsData = [
        {
          title: "实时数据仓库平台", slug: "real-time-dw",
          description: "基于 Flink + Kafka 构建的实时数仓平台，支持秒级数据入仓与查询，服务于实时报表、实时监控等业务场景。",
          role: "技术负责人", period: "2023 - 至今",
          tags: [{ tag: "Flink" }, { tag: "Kafka" }, { tag: "ClickHouse" }, { tag: "实时计算" }],
          highlights: [{ text: "数据延迟从分钟级降低到秒级" }, { text: "支持日均 10 亿+ 数据处理" }, { text: "查询响应时间 < 1 秒" }],
          sortOrder: 1,
        },
        {
          title: "数据质量监控平台", slug: "data-quality-platform",
          description: "自动化数据质量检测与告警系统，覆盖数据完整性、准确性、一致性等多维度质量保障。",
          role: "核心开发者", period: "2022 - 2023",
          tags: [{ tag: "Python" }, { tag: "Airflow" }, { tag: "Grafana" }, { tag: "数据治理" }],
          highlights: [{ text: "自动发现数据质量问题" }, { text: "告警响应时间 < 5 分钟" }, { text: "数据质量事故减少 60%" }],
          sortOrder: 2,
        },
        {
          title: "数据建模框架", slug: "data-modeling-framework",
          description: "基于 dbt 的数据建模框架，标准化数据仓库开发流程，提升团队协作效率。",
          role: "核心开发者", period: "2022",
          tags: [{ tag: "dbt" }, { tag: "SQL" }, { tag: "数据建模" }, { tag: "Snowflake" }],
          highlights: [{ text: "标准化数仓开发流程" }, { text: "模型开发效率提升 40%" }, { text: "文档自动生成" }],
          sortOrder: 3,
        },
        {
          title: "ETL 性能优化项目", slug: "etl-optimization",
          description: "对现有 ETL 链路进行全面性能优化，包括 SQL 重写、资源调优、增量处理改造等。",
          role: "技术负责人", period: "2021 - 2022",
          tags: [{ tag: "Spark" }, { tag: "SQL优化" }, { tag: "性能调优" }, { tag: "Hive" }],
          highlights: [{ text: "核心任务执行时间减少 70%" }, { text: "计算资源节省 50%" }, { text: "数据准确性 100% 保持" }],
          sortOrder: 4,
        },
      ];
      for (const project of projectsData) {
        await payload.create({ collection: "projects", data: project });
      }
      results.push(`✓ ${projectsData.length} projects seeded`);
    } else {
      results.push("⊘ Projects already exist, skipping");
    }

    // 默认管理员 - 由 /api/create-admin 负责创建
    const existingUsers = await payload.find({ collection: "users", limit: 1 });
    if (existingUsers.totalDocs === 0) {
      results.push("⊘ No admin user found. Use /api/create-admin to create one.");
    } else {
      results.push("✓ Admin user already exists");
    }

    results.push("", "✅ Seed complete!");
    results.push("博客文章需通过 /admin 后台手动录入（富文本内容）。");

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", results },
      { status: 500 }
    );
  }
}
