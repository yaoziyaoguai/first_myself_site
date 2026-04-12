# CLAUDE.md

> **User-Defined Repo-Level Entry Point**  
> 这是当前仓库级的 Claude Code 启动入口文件，不是 Claude Code 默认系统文件。

---

## ⚠️ 关键区分：自动加载 vs 协议引导

### 自动加载（Claude 原生）
- ✅ `./CLAUDE.md`（本文件）—— 自动加载
- ✅ `./README.md` —— 自动加载

### 非自动加载（必须通过本协议读取）
以下文件**不会**被 Claude 自动读取，必须通过本协议显式引导：
- ❌ `.claude/user-harness/STATUS.md`
- ❌ `.claude/user-harness/RECENT_SESSIONS.md`

---

## Startup Memory Protocol

每次进入此仓库的新 session，**必须按以下顺序执行**：

### Step 1: 读取 STATUS.md
**文件**：`.claude/user-harness/STATUS.md`  
**目的**：获取当前项目快照

### Step 2: 读取 RECENT_SESSIONS.md
**文件**：`.claude/user-harness/RECENT_SESSIONS.md`  
**目的**：获取最近变化

### Step 3: 输出 PROJECT CONTEXT RESTORED 摘要

**在开始任何实现工作前，必须输出**：

```
═══════════════════════════════════════════════════════════════
                    PROJECT CONTEXT RESTORED
═══════════════════════════════════════════════════════════════

📁 PROJECT: first_myself_site
   个人博客与作品展示站点 | https://wangjinkun333.me

🎯 CURRENT FOCUS:
   [从 STATUS.md 获取当前主线任务]

📊 CURRENT STATUS:
   [从 STATUS.md 获取整体状态]

📈 RECENT PROGRESS:
   [从 RECENT_SESSIONS.md 获取最近完成内容]

🚧 BLOCKERS:
   [从 STATUS.md 获取当前阻碍]

💡 NEXT STEPS:
   [从 STATUS.md 获取下一步建议]

═══════════════════════════════════════════════════════════════
```

---

## Session 更新规则

当本次 session 结束时：

1. **在 RECENT_SESSIONS.md 顶部添加新记录**（按模板格式）

2. **检查记录数量**：
   - 如果 ≤ 5 条：完成
   - 如果 > 5 条：执行 roll-up

3. **Roll-up 操作**（当超过 5 条时）：
   - 读取最旧的一条记录
   - 判断其中哪些信息仍影响当前项目现状
   - 将这些有效信息提炼并更新到 STATUS.md
   - 从 RECENT_SESSIONS.md 删除这条最旧记录
   - 保持 5 条记录

4. **何时更新 STATUS.md**：
   - Roll-up 时（必须）
   - 阶段切换时（主动）
   - 关键决策变化时（主动）

---

## 文件职责

| 文件 | 职责 | 读取时机 |
|------|------|----------|
| `CLAUDE.md` | 启动协议 | 自动加载 |
| `STATUS.md` | 当前项目快照 | 每次启动（协议引导） |
| `RECENT_SESSIONS.md` | 最近 5 条 session | 每次启动（协议引导） |

---

## 快速指令

| 用户说 | Claude 应做 |
|--------|-------------|
| "刷新状态" | 重新读取 STATUS.md + RECENT_SESSIONS.md，输出恢复摘要 |
| "记录本次 session" | 引导在 RECENT_SESSIONS.md 添加记录，检查是否需要 roll-up |

---

**Harness 版本**: v2.0-minimal  
**建立时间**: 2026-04-11
