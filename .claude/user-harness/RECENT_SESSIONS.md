# RECENT_SESSIONS.md

> **User-Defined Harness File**  
> 不是 Claude Code 默认系统文件，而是用户自定义的仓库级记忆机制。  
> **职责**：存储**最近 5 条** session 记录，滑动窗口，不是永久归档。

---

## Roll-up 规则

**当本条数超过 5 条时**：
1. 取最旧的一条
2. 判断哪些信息仍影响当前项目现状
3. 将这些有效信息提炼到 `STATUS.md`
4. 删除这条最旧记录
5. 保持 5 条

**可进入 STATUS.md 的内容**：
- 当前主线任务变化
- 当前 blockers 变化
- 新的关键决策且仍然有效
- 新的关键成果且改变了项目状态

**不应进入 STATUS.md 的内容**：
- 纯过程性细节
- 一次性调试过程
- 已失效的临时问题
- 只对当次 session 有意义的细节

---

## Session 记录模板

```
### YYYY-MM-DD Session

**目标**：（本次要解决的问题）

**完成**：（实际完成的内容）

**改动**：（修改了哪些文件）

**遗留**：（未解决的问题）

**下一步**：（建议的后续行动）

**对当前状态的影响**：（是否改变了项目现状）
```

---

## 最近 Sessions（从新到旧）

### 2026-04-11 Session-001

**目标**：建立极简版跨 session 项目记忆 Harness，替代上一版复杂方案

**完成**：
- 清理了上一版复杂方案（5+ 个文件）
- 建立了新的极简方案（STATUS.md + RECENT_SESSIONS.md）
- 设计了 roll-up 机制和启动加载协议
- 更新了 CLAUDE.md 作为入口

**改动**：
- 删除：USER_MEMORY.md, USER_STATUS.md, USER_SUMMARY.md, USER_INDEX.md, USER_SESSION_TEMPLATE.md, USER_HISTORY/
- 新增：STATUS.md, RECENT_SESSIONS.md
- 更新：CLAUDE.md

**遗留**：无

**下一步**：
- 验证 Harness 是否正常工作
- 在下一个实际开发 session 中试用 roll-up 机制

**对当前状态的影响**：
- 建立了新的项目记忆机制
- 当前项目状态已记录到 STATUS.md

---

**总条数**：1/5  
**最后更新**：2026-04-11
