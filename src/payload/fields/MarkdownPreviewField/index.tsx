"use client";

import React, { useCallback, useEffect, useRef } from "react";
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

  // Refs for scroll sync
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isProgramScrolling = useRef(false);
  const isUserScrollingPreview = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理 timer
  useEffect(() => {
    return () => {
      if (resumeTimer.current) {
        clearTimeout(resumeTimer.current);
      }
    };
  }, []);

  // 左侧 textarea 滚动 - 驱动右侧同步
  const handleTextareaScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview) return;

    // 用户操作左侧时，立即夺回同步控制权
    if (isUserScrollingPreview.current) {
      isUserScrollingPreview.current = false;
      if (resumeTimer.current) {
        clearTimeout(resumeTimer.current);
        resumeTimer.current = null;
      }
    }

    // 计算滚动比例
    const textareaScrollHeight = textarea.scrollHeight - textarea.clientHeight;
    const previewScrollHeight = preview.scrollHeight - preview.clientHeight;
    if (textareaScrollHeight <= 0 || previewScrollHeight <= 0) return;

    const ratio = textarea.scrollTop / textareaScrollHeight;
    const previewScrollTop = ratio * previewScrollHeight;

    // 设置标志：接下来右侧的 scroll 是程序产生的
    isProgramScrolling.current = true;
    preview.scrollTop = previewScrollTop;

    // 下一帧清除标志
    requestAnimationFrame(() => {
      isProgramScrolling.current = false;
    });
  }, []);

  // 右侧预览区滚动 - 检测用户手动滚动
  const handlePreviewScroll = useCallback(() => {
    // 如果是程序设置的 scrollTop，忽略
    if (isProgramScrolling.current) {
      return;
    }

    // 用户手动滚动
    isUserScrollingPreview.current = true;

    // 清除之前的延时
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
    }

    // 150ms 后允许重新被左侧驱动
    resumeTimer.current = setTimeout(() => {
      isUserScrollingPreview.current = false;
    }, 150);
  }, []);

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
            ref={textareaRef}
            id={fieldPath}
            value={value || ""}
            onChange={handleChange}
            onScroll={handleTextareaScroll}
            disabled={readOnly}
            rows={20}
            className={`markdown-textarea ${showError ? "has-error" : ""}`}
            placeholder="在此输入 Markdown..."
          />
        </div>

        {/* 右侧：预览区 */}
        <div className="markdown-preview-pane">
          <div className="pane-header">预览</div>
          <div
            ref={previewRef}
            onScroll={handlePreviewScroll}
            className="markdown-preview-content prose prose-neutral max-w-none"
          >
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
