# 互动 HTML 协议共享样例

同一组样例同时供 TypeScript 与全局发布 Skill 的 Python 预检使用：

- `markers.json`：marker JSON 与期望结果（合法/非法、重复键、Unicode、
  未知字段、id/上限）。
- `html/`：公开副本样例（含 `answer-me-with-html` 适配、CSS 转义 URL、
  远程资源拒绝、data 白名单）。

修改任一侧实现时必须同步运行：

```bash
npx vitest run __tests__/lib/interactive-html/contract.test.ts
cd ~/.codex/skills/publish-site-article && \
  uv run --python 3.12 --with markdown-it-py==4.0.0 \
  --with tinycss2==1.4.0 --with html5lib==1.1 \
  python -m unittest tests.test_publish_article -v
```

两份实现共享输入与预期结论，不要求两个 HTML parser 重新序列化出完全
相同的文档；服务器只保存并返回准备好的准确字节。

`html/am-generated.html` 是实际 `answer-me-with-html` 0.4.8 CLI 生成的无敏感信息样例，输入为“请求排队为什么会变慢”的本地教学文本。CI 使用版本控制内的这个文件实时执行公开副本适配与服务端校验，不依赖开发者的 `.local` 目录。原始隐藏源文也是合成测试内容，不是用户文章。

该生成器的样式/脚本来自 [Answer me with HTML](https://github.com/QingYunA/answer-me-with-html)，其 MIT 许可声明保留在本目录 `LICENSE.answer-me-with-html`。这仅说明该样例的上游许可，不变更本站整体许可证。
