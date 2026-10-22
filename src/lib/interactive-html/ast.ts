import type { PluggableList } from "unified";
import {
  extractInteractiveMarkers,
  type InteractiveHtmlMarker,
} from "./marker";

/**
 * 受控 AST 接入。
 *
 * 只把合法顶层 fenced code node 变成固定元素名 `interactive-html-embed-{id}`
 * 的受控块，保留原始 position。元素名按 id 稳定，使 React 的兄弟 key 在
 * 块前插入/删除普通段落、代码或另一个 marker 时保持不变——这是“同一
 * iframe 实例不重建”的前提。若换成统一的元素名，hast-util-to-jsx-runtime
 * 会按出现顺序编号，插入前面的块就会导致重挂载。
 *
 * 非法 marker 不会变成可执行块，而是保留为普通代码围栏（可见、不可执行）。
 */

export const INTERACTIVE_EMBED_PREFIX = "interactive-html-embed-";

function removeRootSeparators() {
  return (tree: HastRoot) => {
    tree.children = tree.children.filter(
      (node) => node.type !== "text" || !/^\s*$/.test(node.value ?? ""),
    );
  };
}

export function interactiveEmbedTagName(id: string): string {
  return `${INTERACTIVE_EMBED_PREFIX}${id}`;
}

type MdastNode = {
  type?: string;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  position?: {
    start?: { offset?: number; line?: number };
    end?: { offset?: number; line?: number };
  };
  data?: Record<string, unknown>;
  children?: MdastNode[];
};

type MdastRoot = { children: MdastNode[] };
type HastNode = {
  type?: string;
  value?: string;
};
type HastRoot = { children: HastNode[] };

function asProperties(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function markdownBlockKey(
  node: MdastNode,
  source: string,
  occurrences: Map<string, number>,
): string | null {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (start === undefined || end === undefined) return null;
  const block = `${node.type ?? "unknown"}\u0000${source.slice(start, end)}`;
  const occurrence = occurrences.get(block) ?? 0;
  occurrences.set(block, occurrence + 1);
  return `markdown:${block}:${occurrence}`;
}

/**
 * remark 插件：在 mdast 阶段替换顶层 marker 节点。
 * 只处理 `tree.children`，因此引用块、列表、缩进代码里的同名字样不受影响。
 */
export function remarkInteractiveHtml(options: {
  markers: Map<number, InteractiveHtmlMarker>;
  source: string;
}) {
  return (tree: MdastRoot) => {
    if (options.markers.size === 0) return;
    const occurrences = new Map<string, number>();
    tree.children = tree.children.map((node) => {
      if (node.type === "code" && node.lang === "interactive-html") {
        const offset = node.position?.start?.offset;
        const marker =
          offset === undefined ? undefined : options.markers.get(offset);
        if (marker) {
          return {
            type: "paragraph",
            children: [],
            position: node.position,
            data: {
              hName: interactiveEmbedTagName(marker.id),
              hProperties: {
                key: `interactive:${marker.id}`,
                "data-interactive-id": marker.id,
                "data-interactive-caption": marker.caption,
                ...(marker.summary
                  ? { "data-interactive-summary": marker.summary }
                  : {}),
                ...(marker.sha256
                  ? { "data-interactive-sha256": marker.sha256 }
                  : {}),
              },
            },
          };
        }
      }

      const key = markdownBlockKey(node, options.source, occurrences);
      if (!key) return node;
      return {
        ...node,
        data: {
          ...node.data,
          hProperties: {
            ...asProperties(node.data?.hProperties),
            key,
          },
        },
      };
    });
  };
}

/** 解析出的 marker 按源偏移索引，供插件精确匹配到对应节点。 */
export function interactiveMarkerIndex(markdown: string): {
  markers: Map<number, InteractiveHtmlMarker>;
  plugin: PluggableList;
  rehypePlugin: PluggableList;
} {
  const { markers } = extractInteractiveMarkers(markdown, {
    allowLocalPath: false,
  });
  const index = new Map<number, InteractiveHtmlMarker>();
  for (const entry of markers) index.set(entry.start, entry.marker);
  return {
    markers: index,
    plugin: [
      [remarkInteractiveHtml, { markers: index, source: markdown }],
    ] as PluggableList,
    rehypePlugin: (index.size > 0
      ? [removeRootSeparators]
      : []) as PluggableList,
  };
}

export function markerFromElementProps(
  props: Record<string, unknown>,
): InteractiveHtmlMarker | null {
  const id = props["data-interactive-id"];
  const caption = props["data-interactive-caption"];
  const sha256 = props["data-interactive-sha256"];
  const summary = props["data-interactive-summary"];
  if (typeof id !== "string" || typeof caption !== "string") return null;
  return {
    version: 1,
    id,
    ...(typeof sha256 === "string" ? { sha256 } : {}),
    caption,
    ...(typeof summary === "string" && summary ? { summary } : {}),
  };
}
