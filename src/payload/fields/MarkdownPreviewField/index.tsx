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

  // Refs for scroll sync (左侧绝对主导精简版)
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);      // 标记是否正在程序同步中
  const rafId = useRef<number | null>(null);  // 动画帧 ID

  // 轻量平滑过渡（80ms ease-out）
  const smoothScrollTo = useCallback((target: number) => {
    const preview = previewRef.current;
    if (!preview) return;

    // 差距很小，直接设置
    if (Math.abs(preview.scrollTop - target) < 5) {
      preview.scrollTop = target;
      return;
    }

    const start = preview.scrollTop;
    const diff = target - start;
    const duration = 80;  // 80ms 轻量过渡
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const p = Math.min(elapsed / duration, 1);
      // ease-out
      const ease = 1 - Math.pow(1 - p, 2);

      isSyncing.current = true;
      preview.scrollTop = start + diff * ease;

      if (p < 1) {
        rafId.current = requestAnimationFrame(step);
      } else {
        isSyncing.current = false;
      }
    };

    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
  }, []);

  // 左侧 textarea 滚动 - 绝对主导，立即接管
  const handleTextareaScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview) return;

    // 计算左侧比例
    const maxScroll = textarea.scrollHeight - textarea.clientHeight;
    if (maxScroll <= 0) return;
    const ratio = textarea.scrollTop / maxScroll;

    // 目标位置
    const previewMax = preview.scrollHeight - preview.clientHeight;
    const target = ratio * previewMax;

    // 轻量平滑过渡到目标位置
    smoothScrollTo(target);
  }, [smoothScrollTo]);

  // 右侧预览区滚动 - 仅忽略程序触发的scroll
  const handlePreviewScroll = useCallback(() => {
    // 如果是程序同步导致的 scroll，忽略
    if (isSyncing.current) return;
    // 用户手动滚动，不做任何处理
    // 左侧下一次滚动时会立即接管
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
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
