---
title: 评论和点赞功能实施计划
type: feat
status: active
date: 2026-04-17
origin: plan-eng-review 架构评审结果
---

# 评论和点赞功能实施计划

## Overview

为个人博客网站添加评论和点赞功能，支持嵌套回复、匿名评论、博主身份识别。

## Problem Frame

目前博客文章和项目展示页缺乏读者互动机制。读者无法对内容表达反馈（点赞）或参与讨论（评论），博主也无法与读者建立双向沟通。

## Requirements Trace

- R1. 支持匿名评论（无需登录）
- R2. 支持嵌套回复（楼中楼）
- R3. 博主可从前台删除评论
- R4. 博主回复显示"博主"徽章
- R5. 点赞防重复（基于 IP + 浏览器指纹）
- R6. 评论和点赞关联到博客文章和项目
- R7. 分层加载（顶层评论 + 懒加载回复）
- R8. 纯文本评论，自动 XSS 防护

## Scope Boundaries

- **In Scope**: 评论 CRUD、点赞、嵌套回复展示、博主身份识别
- **NOT In Scope**: 
  - 邮件通知
  - 敏感词过滤
  - 评论审核（先审后发）
  - 评论编辑（发布后不可修改）
  - 富文本/Markdown 评论
  - 图片/附件上传
  - 实时更新（WebSocket）
  - IP 速率限制

## Context & Research

### Relevant Code and Patterns

- **Collection 模式**: `src/payload/collections/Blog.ts`、`Projects.ts`、`Users.ts`
- **Access 控制模式**: Users.ts 中基于 role 的权限检查
- **字段验证**: Blog.ts 中 beforeValidate hooks
- **组件模式**: 现有组件在 `components/` 目录，使用 shadcn/ui
- **测试模式**: Vitest + jsdom，测试文件在 `__tests__/` 目录
- **Payload 配置**: `payload.config.ts` 中注册 collections

### Institutional Learnings

- 项目使用 Payload CMS 3.x + PostgreSQL
- 设计系统为 Ollama 极简风格（纯黑白灰）
- 测试覆盖率要求 80%+
- 使用函数式组件 + TypeScript 严格模式

### External References

- Payload CMS Collections 文档: https://payloadcms.com/docs/configuration/collections
- Payload Access Control: https://payloadcms.com/docs/access-control/overview

## Key Technical Decisions

1. **独立 Collections 而非内嵌字段**: Comments 和 Likes 作为独立 collections，不内嵌在 Blog/Projects 中。理由：支持无限扩展，查询灵活，符合 Payload 最佳实践。

2. **parentId 树形结构**: 评论使用 parentId 字段建立层级关系，而非 materialized path 或嵌套集合。理由：实现简单，查询直观，适合 PostgreSQL。

3. **分层懒加载**: 首屏只加载顶层评论，回复按需加载。理由：减少首屏数据量，提升性能。

4. **IP + 指纹防重复点赞**: 结合 IP 哈希和浏览器指纹识别唯一用户。理由：匿名场景下最可靠的识别方式。

5. **纯文本评论**: 不支持 Markdown/HTML，自动 XSS 转义。理由：安全优先，实现简单。

## Open Questions

### Resolved During Planning

- Q: 评论是否支持嵌套回复？A: 支持，使用 parentId 实现
- Q: IP 限速策略？A: 已取消，完全开放
- Q: 垃圾评论防护？A: 无自动防护，依赖博主人工审核

### Deferred to Implementation

- 具体浏览器指纹生成算法（需要调研 fingerprintjs 或自研）
- 评论最大层级限制（待定，建议 3-5 层）

## Implementation Units

### Unit 1: Comments Collection

**Goal:** 创建评论数据模型和 Payload collection

**Requirements:** R1, R2, R6, R8

**Dependencies:** None

**Files:**
- Create: `src/payload/collections/Comments.ts`
- Test: `__tests__/payload/comments.test.ts`

**Approach:**
- 定义 Comments collection 配置
- 配置字段：targetId, targetType, parentId, content, authorName, authorEmail, ipHash, fingerprint, isDeleted, deletedBy, createdAt
- 设置 access 控制：匿名可创建，仅博主可删除
- 添加 beforeValidate hook：验证内容非空、长度限制（1000字符）

**Patterns to follow:**
- 参考 `src/payload/collections/Blog.ts` 的字段定义
- 参考 `src/payload/collections/Users.ts` 的 access 控制

**Test scenarios:**
- Happy path: 创建评论成功，所有字段正确存储
- Edge case: 内容为空时验证失败
- Edge case: 内容超过 1000 字符时验证失败
- Edge case: 嵌套评论 parentId 指向不存在的评论
- Error path: 未提供 targetId 时创建失败

**Verification:**
- Payload 自动生成 REST API 可用
- 数据库表结构正确

---

### Unit 2: Likes Collection

**Goal:** 创建点赞数据模型和 Payload collection

**Requirements:** R5, R6

**Dependencies:** None

**Files:**
- Create: `src/payload/collections/Likes.ts`
- Test: `__tests__/payload/likes.test.ts`

**Approach:**
- 定义 Likes collection 配置
- 配置字段：targetId, targetType, ipHash, fingerprint, createdAt
- 设置复合唯一索引：(targetId, targetType, ipHash, fingerprint) 防重复点赞
- access 控制：匿名可创建，匿名不可删除（点赞后不可取消，简化设计）

**Patterns to follow:**
- 参考 Comments.ts 的字段命名和类型

**Test scenarios:**
- Happy path: 创建点赞成功
- Edge case: 同一 IP + 指纹重复点赞被拒绝
- Edge case: 不同 IP 可以点赞同一内容
- Integration: 点赞后查询计数正确

**Verification:**
- 重复点赞返回 409 冲突错误
- 点赞计数查询正确

---

### Unit 3: Payload Configuration Update

**Goal:** 注册新的 collections 到 Payload

**Requirements:** R1-R8

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `payload.config.ts`

**Approach:**
- 导入 Comments 和 Likes collections
- 添加到 collections 数组

**Test scenarios:**
- Integration: Payload 启动成功，无配置错误

**Verification:**
- `/api/comments` 和 `/api/likes` 端点可访问

---

### Unit 4: Comments API Utilities

**Goal:** 创建评论查询和操作的辅助函数

**Requirements:** R2, R7

**Dependencies:** Unit 1, Unit 3

**Files:**
- Create: `lib/comments.ts`
- Test: `__tests__/lib/comments.test.ts`

**Approach:**
- 创建 `getComments(targetId, targetType)`：查询顶层评论（parentId=null），按时间倒序
- 创建 `getReplies(parentId)`：查询指定评论的回复，按时间正序
- 创建 `buildCommentTree(comments)`：将扁平列表组装为树形结构
- 创建 `createComment(data)`：封装创建逻辑

**Patterns to follow:**
- 参考 `lib/` 目录现有工具函数
- 使用 Payload 的 Local API

**Test scenarios:**
- Happy path: 查询顶层评论返回正确数据
- Happy path: 查询回复返回正确数据
- Happy path: 树形组装结果结构正确
- Edge case: 空评论列表返回空数组
- Edge case: 深层嵌套评论组装正确

**Verification:**
- 所有工具函数单元测试通过

---

### Unit 5: Likes API Utilities

**Goal:** 创建点赞查询和操作的辅助函数

**Requirements:** R5, R6

**Dependencies:** Unit 2, Unit 3

**Files:**
- Create: `lib/likes.ts`
- Test: `__tests__/lib/likes.test.ts`

**Approach:**
- 创建 `getLikesCount(targetId, targetType)`：查询点赞数
- 创建 `hasLiked(targetId, targetType, fingerprint)`：检查用户是否已点赞
- 创建 `createLike(data)`：封装创建逻辑，处理重复点赞

**Test scenarios:**
- Happy path: 查询点赞数正确
- Happy path: 检查是否已点赞准确
- Edge case: 未点赞用户返回 false
- Error path: 重复点赞返回错误信息

**Verification:**
- 所有工具函数单元测试通过

---

### Unit 6: CommentItem Component

**Goal:** 单条评论展示组件（递归渲染回复）

**Requirements:** R2, R4, R7, R8

**Dependencies:** Unit 4

**Files:**
- Create: `components/CommentItem.tsx`
- Test: `__tests__/components/CommentItem.test.tsx`

**Approach:**
- Props: comment, isAuthor（是否博主）, onDelete（删除回调）, onReply（回复回调）
- 渲染评论内容、作者名、时间
- 条件渲染：博主回复显示"博主"徽章
- 条件渲染：博主身份显示删除按钮
- 条件渲染：显示"回复"按钮
- 递归渲染回复列表

**Patterns to follow:**
- 参考 `components/ui/` 组件
- 使用 Tailwind CSS 样式

**Test scenarios:**
- Happy path: 正常评论渲染正确
- Happy path: 博主回复显示徽章
- Happy path: 子评论递归渲染
- Edge case: 已删除评论显示"评论已删除"
- Edge case: 深层嵌套层级限制（如最多显示 5 层）

**Verification:**
- 组件渲染测试通过

---

### Unit 7: CommentForm Component

**Goal:** 评论表单组件

**Requirements:** R1, R8

**Dependencies:** None

**Files:**
- Create: `components/CommentForm.tsx`
- Test: `__tests__/components/CommentForm.test.tsx`

**Approach:**
- Props: onSubmit, parentId（可选，回复时传入）
- 输入字段：昵称（可选，默认"匿名用户"）、邮箱（可选）、内容
- 表单验证：内容必填、长度限制
- 提交状态管理

**Patterns to follow:**
- 参考 shadcn/ui 表单组件

**Test scenarios:**
- Happy path: 填写内容提交成功
- Edge case: 内容为空时阻止提交
- Edge case: 内容过长时显示错误
- Error path: 提交失败时显示错误信息

**Verification:**
- 组件表单验证测试通过

---

### Unit 8: CommentSection Component

**Goal:** 评论列表容器组件

**Requirements:** R2, R7

**Dependencies:** Unit 4, Unit 6, Unit 7

**Files:**
- Create: `components/CommentSection.tsx`
- Test: `__tests__/components/CommentSection.test.tsx`

**Approach:**
- Props: targetId, targetType
- 状态：评论列表、加载状态、博主身份
- 加载顶层评论（分层加载）
- 点击"展开回复"加载子评论
- 处理评论提交（刷新列表）
- 处理评论删除

**Patterns to follow:**
- 参考现有页面组件的数据获取模式

**Test scenarios:**
- Happy path: 加载并显示评论列表
- Happy path: 点击展开回复加载子评论
- Happy path: 提交新评论后列表更新
- Edge case: 无评论时显示空状态
- Edge case: 加载失败时显示错误

**Verification:**
- 组件集成测试通过

---

### Unit 9: LikeButton Component

**Goal:** 点赞按钮组件

**Requirements:** R5

**Dependencies:** Unit 5

**Files:**
- Create: `components/LikeButton.tsx`
- Test: `__tests__/components/LikeButton.test.tsx`

**Approach:**
- Props: targetId, targetType
- 状态：点赞数、是否已点赞、加载状态
- 生成浏览器指纹（使用 fingerprintjs 或自研简单指纹）
- 点击点赞：发送请求，更新状态
- 已点赞后禁用按钮（简化设计，不支持取消）

**Patterns to follow:**
- 参考 shadcn/ui Button 组件

**Test scenarios:**
- Happy path: 显示点赞数
- Happy path: 点击点赞后更新状态
- Edge case: 已点赞状态禁用按钮
- Edge case: 快速重复点击防抖

**Verification:**
- 组件交互测试通过

---

### Unit 10: Blog Detail Page Integration

**Goal:** 在博客详情页集成评论和点赞

**Requirements:** R1-R8

**Dependencies:** Unit 8, Unit 9

**Files:**
- Modify: `app/(main)/blog/[slug]/page.tsx`

**Approach:**
- 导入 CommentSection 和 LikeButton
- 在页面底部添加 CommentSection
- 在文章标题附近添加 LikeButton
- 传递 targetId（博客文章 ID）和 targetType（"blog"）

**Test scenarios:**
- Integration: 页面渲染包含评论和点赞组件

**Verification:**
- 页面正常渲染，无错误

---

### Unit 11: Project Detail Page Integration (Optional)

**Goal:** 在项目展示页集成评论和点赞

**Requirements:** R1-R8

**Dependencies:** Unit 10

**Files:**
- Modify: `app/(main)/projects/[slug]/page.tsx`（如果存在）

**Approach:**
- 类似博客详情页，传递 targetType（"project"）

**Verification:**
- 项目页面正常渲染

---

## System-Wide Impact

- **Interaction graph**: 新增 `/api/comments/*` 和 `/api/likes/*` REST 端点
- **Error propagation**: API 错误通过 Payload 标准错误格式返回
- **State lifecycle risks**: 评论删除使用软删除（isDeleted 标记），保留数据完整性
- **API surface parity**: Payload 自动生成的 API 与自定义工具函数保持一致
- **Integration coverage**: 组件与 API 的集成需测试真实请求
- **Unchanged invariants**: 现有 Blog、Projects collections 不变，通过 targetId 关联

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 垃圾评论泛滥 | 已接受风险，依赖博主人工删除 |
| 浏览器指纹冲突 | 使用 IP + 指纹组合，降低误伤率 |
| 嵌套评论性能 | 分层加载策略，限制查询深度 |
| 数据库存储增长 | 定期清理已删除评论（软删除后物理删除）|

## Documentation / Operational Notes

- Payload Admin 可管理评论和点赞数据
- 博主通过前台删除按钮快速管理评论

## Sources & References

- **Origin document**: plan-eng-review 架构评审结果
- Related code: `src/payload/collections/Blog.ts`, `src/payload/collections/Users.ts`
- Payload docs: https://payloadcms.com/docs/configuration/collections
