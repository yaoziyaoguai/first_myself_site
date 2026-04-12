# MarkdownPreviewField

Payload 3.x 自定义字段组件，为 contentMarkdown 提供双栏实时预览编辑体验。

## 功能特性

- 左侧 Markdown 编辑区（textarea）
- 右侧实时预览区（react-markdown + remark-gfm）
- 响应式布局：桌面端左右分栏，移动端上下分栏
- 完全兼容 Payload 的表单状态管理
- 支持 GFM 扩展语法（表格、任务列表等）

## 使用方法

在 `src/payload/collections/Blog.ts` 中配置：

```typescript
{
  name: "contentMarkdown",
  type: "textarea",
  label: "文章内容 (Markdown)",
  admin: {
    components: {
      Field: "@/payload/fields/MarkdownPreviewField#MarkdownPreviewField"
    }
  }
}
```

然后更新 `app/(payload)/admin/importMap.js` 注册组件。

## 技术实现

### Props 接口

组件接收 Payload 标准的 Field props：

- `path`: 字段路径
- `value`: 当前值
- `setValue`: 更新值的回调函数
- `readOnly`: 是否只读
- `required`: 是否必填
- `label`: 字段标签
- `description`: 字段描述
- `hasError`/`errorMessage`: 校验错误信息

### 状态同步

1. 本地状态 `localValue` 驱动 textarea 显示
2. 用户输入时调用 `setValue(newValue)` 同步到 Payload form state
3. Payload 保存时自动持久化到数据库

### 样式系统

- 使用 Payload Admin 的 CSS 变量（`--theme-*`）确保主题一致
- 预览区使用 Tailwind Typography 的 `prose` 类
- 响应式断点：1024px

## 文件结构

```
src/payload/fields/MarkdownPreviewField/
├── index.tsx    # 组件主体
├── styles.css   # 样式文件
└── README.md    # 本文档
```

## 注意事项

1. 必须使用 "use client" 标记为客户端组件
2. react-markdown 和 remark-gfm 已存在于项目依赖中
3. 样式使用 Payload Admin 的 CSS 变量，支持 dark/light 主题切换
