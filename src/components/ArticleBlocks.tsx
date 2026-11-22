import type { Element } from "hast";
import type { ReactNode } from "react";

export function ArticleCodeBlock({
  node,
  children,
  action,
  sourceOffset,
}: {
  node: Element;
  children: ReactNode;
  action?: ReactNode;
  sourceOffset?: number;
}) {
  const { "data-language": language, "data-lines": lines } = node.properties;
  return (
    <div className="article-code" data-source-offset={sourceOffset}>
      <div className="article-code-toolbar">
        <span>{language!.toString()}</span>
        <span>{lines!.toString()} 行</span>
        {action}
      </div>
      <pre tabIndex={0} role="region" aria-label="可横向滚动的代码">
        {children}
      </pre>
    </div>
  );
}

export function ArticleTable({ children, sourceOffset }: { children: ReactNode; sourceOffset?: number }) {
  return (
    <div
      aria-label="可横向滚动的表格"
      className="article-table-scroll"
      role="region"
      tabIndex={0}
      data-source-offset={sourceOffset}
    >
      <table>{children}</table>
    </div>
  );
}
