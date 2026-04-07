---
title: Blog 编辑器改造 - 支持 Markdown 工作流
type: feat
status: active
date: 2025-04-07
---

# Blog 编辑器改造 - 支持 Markdown 工作流

## 概述

将 Blog 正文从 Lexical 富文本编辑器改为 Markdown 编辑工作流，提供更纯粹的技术写作体验，同时保持现有页面展示和类型检查兼容。

## 问题框架

当前 Blog 使用 Payload 的 Lexical 富文本编辑器（`richText` 类型），对于技术写作场景：
- 富文本编辑器对代码块、表格等 Markdown 原生支持不如纯 Markdown 编辑器
- 技术作者更习惯直接在 Markdown 中写作
- 富文本的 JSON 格式在版本控制中不易读

目标是在最小改动前提下，为 Blog 正文提供 Markdown 编辑支持。

## 需求追溯

- R1. Blog 正文支持 Markdown 编辑
- R2. 前端正确渲染 Markdown 内容
- R3. 不破坏现有页面展示、类型检查、测试和构建
- R4. 改动最小化，优先复用现有架构

## 范围边界

- **在范围内:**
  - Blog collection 配置
  - Blog 详情页渲染逻辑
  - 类型定义更新
  - 新增 Markdown 渲染依赖

- **不在范围内:**
  - 现有 richText 字段的迁移（保留作为兼容字段）
  - 其他 collection 的改造
  - CI workflow 修改
  - 数据库迁移脚本（手动处理）

## 上下文与研究

### 相关代码和模式

**Blog Collection:**
- 文件: `src/payload/collections/Blog.ts`
- 当前 content 字段: `type: "richText"` (第78-82行)
- 字段配置包含 required: true

**前端渲染:**
- 文件: `app/(main)/blog/[slug]/page.tsx`
- 当前使用: `@payloadcms/richtext-lexical/react` 的 `RichText` 组件
- 转换器: `defaultJSXConverters`

**Payload 配置:**
- 文件: `payload.config.ts`
- 使用: `lexicalEditor()` 作为默认编辑器

### 技术决策

**决策: 使用 `code` 字段类型存储 Markdown，而非配置 Lexical 的 Markdown 模式**

理由:
1. `code` 字段提供原生 Markdown 编辑体验（Payload 内置代码编辑器支持语法高亮）
2. 改动最小：只需添加新字段，无需修改编辑器配置
3. 数据格式简单：纯字符串，易于版本控制和备份
4. 前端渲染可控：使用 react-markdown 可自定义组件映射

**决策: 保留现有 content 字段作为向后兼容**

理由:
1. 避免破坏现有数据
2. 允许渐进式迁移
3. 渲染时可优先使用新字段

## 实现单元

- [ ] **单元 1: 添加 Markdown 字段到 Blog Collection**

**目标:** 在 Blog collection 中添加 `contentMarkdown` 字段

**需求:** R1

**依赖:** 无

**文件:**
- 修改: `src/payload/collections/Blog.ts`

**方法:**
- 在 content 字段后添加新的 `contentMarkdown` 字段
- 类型: `code`（Payload 内置的代码编辑器，支持 Markdown 语法高亮）
- 配置 `language: "markdown"` 指定为 Markdown 模式
- 设置为非必填，允许空值

**模式遵循:**
- 参考现有字段配置模式（如 readingTime、excerpt 等文本字段）

**测试场景:**
- Happy path: 创建 Blog 时填写 contentMarkdown，保存成功
- Edge case: contentMarkdown 为空，保存成功（非必填）
- Integration: Payload Admin 中能看到 Markdown 编辑器

**验证:**
- Payload Admin 中编辑 Blog 时能看到 Markdown 编辑器
- 可以保存 Markdown 内容并在数据库中正确存储

---

- [ ] **单元 2: 安装 Markdown 渲染依赖**

**目标:** 添加前端 Markdown 渲染能力

**需求:** R2

**依赖:** 无

**文件:**
- 修改: `package.json`

**方法:**
- 安装 `react-markdown` 和 `remark-gfm`（支持 GitHub Flavored Markdown）
- 安装 `@types/react-markdown`（如需要）

**技术设计:**
```
依赖:
- react-markdown: ^9.x (核心渲染)
- remark-gfm: ^4.x (表格、任务列表等扩展语法)
```

**模式遵循:**
- 参考项目中其他依赖的版本范围

**测试场景:**
- Integration: 安装后 `npm run build` 能成功

**验证:**
- `npm install` 成功
- `npm run build` 通过

---

- [ ] **单元 3: 更新 Blog 详情页渲染逻辑**

**目标:** 使用 react-markdown 渲染 Markdown 内容

**需求:** R2, R3

**依赖:** 单元 2（依赖安装）

**文件:**
- 修改: `app/(main)/blog/[slug]/page.tsx`

**方法:**
1. 导入 `react-markdown` 和 `remark-gfm`
2. 修改渲染逻辑：优先使用 `contentMarkdown`，如果不存在则回退到 `content`（RichText）
3. 添加 prose 样式类确保 Markdown 内容正确渲染
4. 配置代码块语法高亮（使用现有项目中已配置的样式）

**技术设计:**
```
渲染优先级:
1. 如果 contentMarkdown 存在且有内容 → 使用 react-markdown 渲染
2. 否则如果 content 存在 → 使用 RichText 组件渲染（向后兼容）
3. 否则 → 显示空内容
```

**模式遵循:**
- 参考现有 `RichText` 组件的使用方式
- 保持现有的 `prose prose-neutral dark:prose-invert max-w-none` 样式类

**测试场景:**
- Happy path: contentMarkdown 有内容，正确渲染 Markdown
- Edge case: contentMarkdown 为空，回退到 content（RichText）
- Edge case: contentMarkdown 包含代码块，正确渲染
- Edge case: contentMarkdown 包含表格（GFM），正确渲染
- Error path: Markdown 语法错误，react-markdown 能安全处理

**验证:**
- 页面能正确渲染 Markdown 内容
- 代码块、表格、列表等 Markdown 元素正确显示
- 向后兼容：现有只有 content 的文章仍能正常显示

---

- [ ] **单元 4: 更新类型定义（如需要）**

**目标:** 确保 TypeScript 类型正确

**需求:** R3

**依赖:** 单元 1

**文件:**
- 检查并更新: 相关类型定义文件（如有）

**方法:**
- 检查 Payload 生成的类型（`payload-types.ts` 或类似）
- 确保 `contentMarkdown` 字段在类型中正确声明

**测试场景:**
- Happy path: `npx tsc --noEmit` 无类型错误

**验证:**
- `npx tsc --noEmit` 通过

---

- [ ] **单元 5: 验证所有质量门禁**

**目标:** 确保所有硬性要求通过

**需求:** R3, R4

**依赖:** 单元 1-4

**文件:**
- 运行: 整个项目

**方法:**
1. 运行 `npm run lint`
2. 运行 `npx tsc --noEmit`
3. 运行 `npm test`
4. 运行 `npm run build`（使用 CI 环境变量）

**测试场景:**
- Integration: 所有命令返回 0

**验证:**
- lint 无错误
- type-check 无错误
- test 全部通过
- build 成功

## 系统级影响

- **交互图:** 
  - Payload Admin: 新增 Markdown 编辑器界面
  - 前端渲染: 根据字段存在性选择渲染方式
  - 数据库: 新增 `contentMarkdown` 字段（可为空）

- **错误传播:**
  - react-markdown 渲染错误应被捕获，避免页面崩溃
  - 优先使用 try-catch 包装 Markdown 渲染

- **状态生命周期风险:**
  - 现有 content 数据不受影响
  - 新字段可为空，无数据迁移风险

- **API 表面一致性:**
  - GraphQL/REST API 自动暴露新字段
  - 保持向后兼容

- **未改变的不变式:**
  - 现有访问控制逻辑不变
  - 现有页面路由不变
  - 现有富文本渲染能力保留

## 风险与依赖

| 风险 | 缓解措施 |
|------|----------|
| react-markdown 与 Tailwind prose 样式冲突 | 测试常见 Markdown 元素渲染，必要时调整样式 |
| Payload code 字段在 Admin 中编辑体验不佳 | 配置 `language: "markdown"` 启用语法高亮 |
| 代码块语法高亮需要额外配置 | 评估是否需要引入 react-syntax-highlighter |

## 文档与操作说明

- 在 Blog Admin 界面中，作者现在可以使用 Markdown 编辑内容
- 现有文章继续使用 RichText 渲染，直到手动迁移
- 如需迁移现有文章：复制 content 的 JSON 内容，转换为 Markdown，粘贴到 contentMarkdown

## 来源与参考

- **相关代码:**
  - `src/payload/collections/Blog.ts` (Blog collection 配置)
  - `app/(main)/blog/[slug]/page.tsx` (Blog 详情页)
  - `payload.config.ts` (Payload 配置)
- **外部文档:**
  - Payload Code Field: https://payloadcms.com/docs/fields/code
  - react-markdown: https://github.com/remarkjs/react-markdown
  - remark-gfm: https://github.com/remarkjs/remark-gfm
