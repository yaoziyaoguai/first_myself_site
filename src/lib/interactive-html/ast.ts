import type { Root } from "mdast";
import { INTERACTIVE_HTML_FENCE, parseMarkerJson, type InteractiveHtmlMarker } from "./marker";

export const INTERACTIVE_EMBED_PREFIX = "interactive-html-embed-";

/** 元素名按 marker id 保持稳定，编辑其他段落时不会重挂载 iframe。 */
export function remarkInteractiveHtml() {
  return (tree: Root) => {
    const seen = new Set<string>();
    tree.children = tree.children.map((node) => {
      if (node.type !== "code" || node.lang !== INTERACTIVE_HTML_FENCE) return node;
      const parsed = parseMarkerJson(node.value, { allowLocalPath: false, meta: node.meta });
      if (!parsed.ok || seen.has(parsed.marker.id)) return node;

      const { id, caption, summary, sha256 } = parsed.marker;
      seen.add(id);
      return {
        type: "paragraph",
        children: [],
        position: node.position,
        data: {
          hName: `${INTERACTIVE_EMBED_PREFIX}${id}`,
          hProperties: {
            "data-interactive-id": id,
            "data-interactive-caption": caption,
            "data-interactive-summary": summary,
            "data-interactive-sha256": sha256,
          },
        },
      };
    });
  };
}

export function markerFromElementProps(props: Record<string, unknown>): InteractiveHtmlMarker {
  return {
    version: 1,
    id: props["data-interactive-id"] as string,
    caption: props["data-interactive-caption"] as string,
    sha256: props["data-interactive-sha256"] as string,
    summary: props["data-interactive-summary"] as string | undefined,
  };
}
