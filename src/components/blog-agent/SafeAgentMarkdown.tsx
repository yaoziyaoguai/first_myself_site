import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function SafeAgentMarkdown({ content }: { content: string }) {
  return (
    <div className="blog-agent-answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children }) => <span>{children}</span>,
          img: () => null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
