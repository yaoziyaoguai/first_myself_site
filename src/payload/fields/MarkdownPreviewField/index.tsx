"use client";

import React, { useCallback, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useField,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@payloadcms/ui";
import type {
  TextareaFieldClientComponent,
  StaticDescription,
} from "payload";

import "./styles.css";

/**
 * MarkdownPreviewField
 *
 * Payload 3 custom Field component for textarea fields that should render a
 * side-by-side Markdown editor + live preview inside the admin UI.
 *
 * Registered via `admin.components.Field` on the textarea field config, e.g.
 *   Field: '@/payload/fields/MarkdownPreviewField#MarkdownPreviewField'
 *
 * Alignment strategy:
 *   - Scroll-driven sync: left textarea onScroll → preview scrollTop by
 *     proportional ratio. Single direction — the left pane is authoritative.
 *   - `isSyncing` prevents programmatic scrolls from re-entering the loop.
 *   - rAF + 80ms ease-out (scrollPreviewTo) for smooth transitions.
 *
 * Cursor-driven sync was tried and removed (see commit history): the precision
 * benefit was too small to justify the interaction complexity. Typing still
 * updates the preview content (Markdown re-renders from `value`), but the
 * preview scroll position is only driven by the user scrolling the editor.
 */

const SMOOTH_SCROLL_MS = 80;

/**
 * Narrow a Payload field description (which may be a function on the server
 * config) down to the StaticDescription that survives client sanitization.
 */
function asStaticDescription(
  value: unknown
): StaticDescription | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as StaticDescription;
  }
  return undefined;
}

export const MarkdownPreviewField: TextareaFieldClientComponent = ({
  field,
  path,
  readOnly: readOnlyFromProps,
}) => {
  // Note: useField returns `disabled` (runtime state from form/permissions).
  // The legacy `readOnly` return is @deprecated in 3.79.0 and no longer populated
  // at runtime, so we read `disabled` instead. See @payloadcms/ui/dist/forms/useField/types.d.ts.
  const { value, setValue, showError, errorMessage, disabled } =
    useField<string>({ path });

  const readOnly = Boolean(readOnlyFromProps || disabled);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);
  const rafId = useRef<number | null>(null);

  /**
   * rAF-driven smooth scroll of the preview pane. Always flips `isSyncing` so
   * the preview's own onScroll handler can ignore programmatic movement.
   */
  const scrollPreviewTo = useCallback((target: number) => {
    const preview = previewRef.current;
    if (!preview) return;

    const start = preview.scrollTop;
    const diff = target - start;

    if (Math.abs(diff) < 2) {
      isSyncing.current = true;
      preview.scrollTop = target;
      // Release on next frame so a stray onScroll can't mis-read the flag.
      requestAnimationFrame(() => {
        isSyncing.current = false;
      });
      return;
    }

    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const p = Math.min(elapsed / SMOOTH_SCROLL_MS, 1);
      const ease = 1 - Math.pow(1 - p, 2);
      isSyncing.current = true;
      preview.scrollTop = start + diff * ease;
      if (p < 1) {
        rafId.current = requestAnimationFrame(step);
      } else {
        rafId.current = null;
        // Release on next frame: preview's onScroll can fire one more tick.
        requestAnimationFrame(() => {
          isSyncing.current = false;
        });
      }
    };

    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(step);
  }, []);

  /**
   * Scroll-driven: preserve left scroll ratio on the right.
   */
  const syncPreviewToScrollRatio = useCallback(() => {
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview) return;

    const editorMax = textarea.scrollHeight - textarea.clientHeight;
    if (editorMax <= 0) return;

    const ratio = textarea.scrollTop / editorMax;
    const previewMax = preview.scrollHeight - preview.clientHeight;
    scrollPreviewTo(ratio * previewMax);
  }, [scrollPreviewTo]);

  // --- Event handlers -----------------------------------------------------

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      // Preserve the "empty → null" semantics so beforeValidate sees null,
      // not an empty string. Matches the existing field's expectations.
      setValue(next || null);
    },
    [setValue]
  );

  const handleTextareaScroll = useCallback(() => {
    syncPreviewToScrollRatio();
  }, [syncPreviewToScrollRatio]);

  // --- Cleanup ------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // --- Render -------------------------------------------------------------

  const description = asStaticDescription(field?.admin?.description);
  // `useField<string>` is a type assertion — at runtime `value` can be null
  // (we call `setValue(null)` on empty input to match beforeValidate semantics).
  // `|| ""` is the runtime fallback, not dead code.
  const content = value || "";

  return (
    <div className="mpf-wrapper field-type">
      <FieldLabel
        htmlFor={`field-${path.replace(/\./g, "__")}`}
        label={field?.label}
        required={field?.required}
        path={path}
      />
      {description && (
        <FieldDescription path={path} description={description} />
      )}

      <div className={`mpf-panes${showError ? " mpf-panes--error" : ""}`}>
        <div className="mpf-pane mpf-pane--edit">
          <div className="mpf-pane-header">编辑</div>
          <textarea
            ref={textareaRef}
            id={`field-${path.replace(/\./g, "__")}`}
            className="mpf-textarea"
            value={content}
            disabled={readOnly}
            onChange={handleChange}
            onScroll={handleTextareaScroll}
            placeholder="在此输入 Markdown…"
            spellCheck={false}
          />
        </div>
        <div className="mpf-pane mpf-pane--preview">
          <div className="mpf-pane-header">预览</div>
          <div ref={previewRef} className="mpf-preview">
            {content.trim() ? (
              <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
            ) : (
              <div className="mpf-preview-empty">（无内容预览）</div>
            )}
          </div>
        </div>
      </div>

      <FieldError
        path={path}
        message={errorMessage}
        showError={showError}
      />
    </div>
  );
};

export default MarkdownPreviewField;
