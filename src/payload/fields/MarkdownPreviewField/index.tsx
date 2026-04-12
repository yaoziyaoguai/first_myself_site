"use client";

import React, { useCallback } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useField } from "@payloadcms/ui";
import type { TextareaFieldClient, FieldPaths } from "payload";
import "./styles.css";

/**
 * MarkdownPreviewField
 * Payload 3.x 自定义字段组件
 * 为 contentMarkdown 提供双栏实时预览编辑体验
 *
 * 使用 useField hook 从 Payload form state 获取和更新值
 * @see https://payloadcms.com/docs/admin/react-hooks#usefield
 */

interface MarkdownPreviewFieldProps extends FieldPaths {
  /** 字段配置 */
  field: TextareaFieldClient;
  /** 是否只读 */
  readOnly?: boolean;
}

/**
 * 从 @payloadcms/ui 导入的 useField 返回类型
 * 简化版，避免引入过多依赖类型
 */
interface FieldType<T> {
  value: T;
  setValue: (val: unknown, disableModifyingForm?: boolean) => void;
  path: string;
  disabled: boolean;
  showError: boolean;
  errorMessage?: string;
}

export function MarkdownPreviewField({
  field,
  path,
  readOnly: readOnlyFromProps,
}: MarkdownPreviewFieldProps) {
  // 使用 useField hook 从 Payload form state 获取值和 setter
  const {
    value,
    setValue,
    path: fieldPath,
    disabled,
    showError,
    errorMessage,
  } = useField<string>({ path }) as FieldType<string>;

  // 合并 readOnly 状态（来自 props 或 field 配置）
  const readOnly = readOnlyFromProps || disabled;

  // 获取字段标签和描述
  const rawLabel = field?.label || "文章内容 (Markdown)";
  const label = typeof rawLabel === "string" ? rawLabel : "文章内容 (Markdown)";
  const description = field?.admin?.description;

  // 处理 textarea 变化
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      // 同步到 Payload 的 form state
      setValue(newValue || null);
    },
    [setValue]
  );

  // 渲染预览内容
  const renderPreview = () => {
    const content = (value || "").trim();

    if (!content) {
      return (
        <div className="markdown-preview-empty">
          <p>（无内容预览）</p>
        </div>
      );
    }

    return (
      <Markdown remarkPlugins={[remarkGfm]}>
        {content}
      </Markdown>
    );
  };

  return (
    <div className="markdown-preview-field">
      {/* 字段标签 */}
      <div className="markdown-preview-label">
        <label htmlFor={fieldPath}>
          {label}
          {field?.required && <span className="required-indicator"> *</span>}
        </label>
      </div>

      {/* 描述文字 */}
      {description && (
        <div className="markdown-preview-description">{description as string}</div>
      )}

      {/* 双栏编辑区 */}
      <div className="markdown-preview-container">
        {/* 左侧：编辑区 */}
        <div className="markdown-editor-pane">
          <div className="pane-header">编辑</div>
          <textarea
            id={fieldPath}
            value={value || ""}
            onChange={handleChange}
            disabled={readOnly}
            rows={20}
            className={`markdown-textarea ${showError ? "has-error" : ""}`}
            placeholder="在此输入 Markdown..."
          />
        </div>

        {/* 右侧：预览区 */}
        <div className="markdown-preview-pane">
          <div className="pane-header">预览</div>
          <div className="markdown-preview-content prose prose-neutral max-w-none">
            {renderPreview()}
          </div>
        </div>
      </div>

      {/* 错误信息 */}
      {showError && errorMessage && (
        <div className="markdown-preview-error">{errorMessage}</div>
      )}
    </div>
  );
}

export default MarkdownPreviewField;
