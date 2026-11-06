# 交付可靠性与依赖恢复：互动内容更新包

目标为现有文章 `/blog/governance-longform-03-reliability-recovery`。`article.md` 来自 2026-11-06 匿名公开 API，仅替换两处互动 marker 的资源路径和说明；原有标题、正文段落和章节保留。没有公司内部材料或真实生产数据，互动事件均明确为教学合成。

- `interactive/delivery-timeline.html`：观察时间可回退 / 逐步推进 / 播放，运行、产出和消费证据独立计算；保留四种场景，不能把强制成功或未知终态算成交付。
- `interactive/dependency-steps.html`：按依赖执行跨日链，缺少历史产出时阻塞；同轮两个对象以真实闭环表示互相等待，不以重复尝试或删除一条边伪装修复。

两个文件均自包含，使用文章既有纸色 / 品牌蓝，内联 CSS / SVG / JavaScript，无外部网络、字体、真实用户数据或依赖。它们不是生产系统模拟器，也不生成生产操作指令。

## 发布边界

本次只提交 / 推送，不合并部署，也不更新线上 CMS。`docs/` 不进入 Docker 镜像；GitHub Actions 部署应用并不会自动更新数据库里的文章，不能把本包当作已上线。

获得后续上线与覆盖该篇公开文章的明确授权后，先按既有 GitHub 流程部署容器改进，再由全局 `publish-site-article` 对本文件夹的 `article.md` 执行 `plan` 和 `update-published --confirm-published-update`。不要创建同名新文章；沿用 Skill 的并发复核、资源回读、元数据保留和 ready Agent package 原子更新门禁。若线上正文已变，应先重新取得公开版本并合并两处 marker，不能用这里的历史快照覆盖新文字。

发布前后均需在实际文章路由检查桌面 / 手机：关键图和结论可读、控件改变实际证据或执行状态、宽屏展开不溢出、收回保留同一个 iframe 与进度。未知状态和示意数据不能变成真实系统结论。安全预检成功不能代替这些验收。

本机 Codex 全局发布 Skill 已补充「互动成品检查」；Claude Code 使用原有 symlink，共用同一份。该全局配置不会随网站 Actions 自动安装到别的电脑；便携变更见同目录 `publish-skill-quality.patch`，应用前先核对目标 Skill 版本，不覆盖其他更新。
