"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useField,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@payloadcms/ui";
import type { TextareaFieldClientComponent, StaticDescription } from "payload";

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
 *   - The hidden source mirror measures actual wrapped Markdown line positions.
 *   - React Markdown exposes source offsets on rendered block nodes.
 *   - Matching source/preview anchors are interpolated in both directions.
 *
 * This avoids the drift caused by global scroll ratios when rendered images,
 * tables, headings, and paragraph spacing have very different local heights.
 */

type ScrollAnchor = {
  source: number;
  target: number;
};

type ScrollMapInput = {
  sourceScrollTop: number;
  sourceMax: number;
  targetMax: number;
  anchors: ScrollAnchor[];
};

type SourceMarker = {
  offset: number;
  top: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function findSourceMarker(markers: SourceMarker[], offset: number) {
  let match: SourceMarker | undefined;
  for (const marker of markers) {
    if (marker.offset > offset) break;
    match = marker;
  }
  return match;
}

/** Map a scroll position between panes while preserving local content anchors. */
export function mapScrollTopByAnchors({
  sourceScrollTop,
  sourceMax,
  targetMax,
  anchors,
}: ScrollMapInput) {
  if (sourceMax <= 0 || targetMax <= 0) return 0;

  const points = [
    { source: 0, target: 0 },
    ...anchors.filter(
      ({ source, target }) =>
        source > 0 && source < sourceMax && target > 0 && target < targetMax,
    ),
    { source: sourceMax, target: targetMax },
  ]
    .sort((a, b) => a.source - b.source)
    .reduce<ScrollAnchor[]>((result, point) => {
      const previous = result.at(-1);
      if (previous?.source === point.source) return result;

      result.push({
        source: point.source,
        target: Math.max(previous?.target ?? 0, point.target),
      });
      return result;
    }, []);

  const position = clamp(sourceScrollTop, 0, sourceMax);
  for (let index = 1; index < points.length; index += 1) {
    const end = points[index];
    if (position > end.source) continue;

    const start = points[index - 1];
    const span = end.source - start.source;
    if (span <= 0) return clamp(end.target, 0, targetMax);

    const progress = (position - start.source) / span;
    return clamp(
      start.target + (end.target - start.target) * progress,
      0,
      targetMax,
    );
  }

  return targetMax;
}

function sourceOffset(node?: { position?: { start?: { offset?: number } } }) {
  return node?.position?.start?.offset;
}

const markdownComponents: Components = {
  h1: ({ node, ...props }) => (
    <h1 data-source-offset={sourceOffset(node)} {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 data-source-offset={sourceOffset(node)} {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 data-source-offset={sourceOffset(node)} {...props} />
  ),
  h4: ({ node, ...props }) => (
    <h4 data-source-offset={sourceOffset(node)} {...props} />
  ),
  h5: ({ node, ...props }) => (
    <h5 data-source-offset={sourceOffset(node)} {...props} />
  ),
  h6: ({ node, ...props }) => (
    <h6 data-source-offset={sourceOffset(node)} {...props} />
  ),
  p: ({ node, ...props }) => (
    <p data-source-offset={sourceOffset(node)} {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote data-source-offset={sourceOffset(node)} {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul data-source-offset={sourceOffset(node)} {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol data-source-offset={sourceOffset(node)} {...props} />
  ),
  pre: ({ node, ...props }) => (
    <pre data-source-offset={sourceOffset(node)} {...props} />
  ),
  table: ({ node, ...props }) => (
    <table data-source-offset={sourceOffset(node)} {...props} />
  ),
  hr: ({ node, ...props }) => (
    <hr data-source-offset={sourceOffset(node)} {...props} />
  ),
};

function getSourceLines(content: string) {
  let offset = 0;
  return content.split("\n").map((line, index, lines) => {
    const lineStart = offset;
    offset += line.length + (index < lines.length - 1 ? 1 : 0);
    return { line, lineStart, hasNewline: index < lines.length - 1 };
  });
}

/**
 * Narrow a Payload field description (which may be a function on the server
 * config) down to the StaticDescription that survives client sanitization.
 */
function asStaticDescription(value: unknown): StaticDescription | undefined {
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
  // `useField<string>` is a type assertion; empty input is persisted as null.
  const content = value || "";

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sourceMapRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);
  const rafId = useRef<number | null>(null);
  const layoutRafId = useRef<number | null>(null);
  const lastUserPane = useRef<"editor" | "preview">("editor");

  const sourceLines = useMemo(() => getSourceLines(content), [content]);

  const collectAnchors = useCallback(() => {
    const textarea = textareaRef.current;
    const sourceMap = sourceMapRef.current;
    const preview = previewRef.current;
    if (!textarea || !sourceMap || !preview) return [];

    sourceMap.style.width = `${textarea.clientWidth}px`;

    const sourceMarkers = Array.from(
      sourceMap.querySelectorAll<HTMLElement>("[data-source-offset]"),
    ).map((element) => ({
      offset: Number(element.dataset.sourceOffset),
      top: element.offsetTop,
    }));

    const editorMax = textarea.scrollHeight - textarea.clientHeight;
    const previewMax = preview.scrollHeight - preview.clientHeight;
    const anchors: ScrollAnchor[] = [];

    for (const element of preview.querySelectorAll<HTMLElement>(
      "[data-source-offset]",
    )) {
      const offset = Number(element.dataset.sourceOffset);
      if (!Number.isFinite(offset)) continue;

      const sourceMarker = findSourceMarker(sourceMarkers, offset);
      if (!sourceMarker) continue;

      anchors.push({
        source: clamp(sourceMarker.top, 0, editorMax),
        target: clamp(element.offsetTop, 0, previewMax),
      });
    }

    return anchors;
  }, []);

  const syncScroll = useCallback(
    (direction: "editor-to-preview" | "preview-to-editor") => {
      if (isSyncing.current) return;

      const textarea = textareaRef.current;
      const preview = previewRef.current;
      if (!textarea || !preview) return;

      const editorMax = textarea.scrollHeight - textarea.clientHeight;
      const previewMax = preview.scrollHeight - preview.clientHeight;
      const anchors = collectAnchors();

      const source = direction === "editor-to-preview" ? textarea : preview;
      const target = direction === "editor-to-preview" ? preview : textarea;
      const mappedAnchors =
        direction === "editor-to-preview"
          ? anchors
          : anchors.map((anchor) => ({
              source: anchor.target,
              target: anchor.source,
            }));

      isSyncing.current = true;
      target.scrollTop = mapScrollTopByAnchors({
        sourceScrollTop: source.scrollTop,
        sourceMax: direction === "editor-to-preview" ? editorMax : previewMax,
        targetMax: direction === "editor-to-preview" ? previewMax : editorMax,
        anchors: mappedAnchors,
      });

      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        isSyncing.current = false;
        rafId.current = null;
      });
    },
    [collectAnchors],
  );

  // --- Event handlers -----------------------------------------------------

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      // Preserve the "empty → null" semantics so beforeValidate sees null,
      // not an empty string. Matches the existing field's expectations.
      setValue(next || null);
    },
    [setValue],
  );

  const handleTextareaScroll = useCallback(() => {
    if (!isSyncing.current) lastUserPane.current = "editor";
    syncScroll("editor-to-preview");
  }, [syncScroll]);

  const handlePreviewScroll = useCallback(() => {
    if (!isSyncing.current) lastUserPane.current = "preview";
    syncScroll("preview-to-editor");
  }, [syncScroll]);

  const handlePreviewLayoutChange = useCallback(() => {
    if (layoutRafId.current) cancelAnimationFrame(layoutRafId.current);

    const syncLatestLayout = () => {
      if (isSyncing.current) {
        layoutRafId.current = requestAnimationFrame(syncLatestLayout);
        return;
      }

      layoutRafId.current = null;
      syncScroll(
        lastUserPane.current === "preview"
          ? "preview-to-editor"
          : "editor-to-preview",
      );
    };

    layoutRafId.current = requestAnimationFrame(syncLatestLayout);
  }, [syncScroll]);

  // --- Cleanup ------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (layoutRafId.current) cancelAnimationFrame(layoutRafId.current);
    };
  }, []);

  // --- Render -------------------------------------------------------------

  const description = asStaticDescription(field?.admin?.description);

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
          <div className="mpf-editor-surface">
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
            <div ref={sourceMapRef} className="mpf-source-map" aria-hidden>
              {sourceLines.map(({ line, lineStart, hasNewline }) => (
                <React.Fragment key={lineStart}>
                  <span data-source-offset={lineStart} />
                  {line}
                  {hasNewline ? "\n" : null}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        <div className="mpf-pane mpf-pane--preview">
          <div className="mpf-pane-header">预览</div>
          <div
            ref={previewRef}
            className="mpf-preview"
            onScroll={handlePreviewScroll}
            onLoadCapture={handlePreviewLayoutChange}
          >
            {content.trim() ? (
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {content}
              </Markdown>
            ) : (
              <div className="mpf-preview-empty">（无内容预览）</div>
            )}
          </div>
        </div>
      </div>

      <FieldError path={path} message={errorMessage} showError={showError} />
    </div>
  );
};

export default MarkdownPreviewField;
