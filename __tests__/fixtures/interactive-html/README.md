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
