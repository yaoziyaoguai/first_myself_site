export type BlogAgentCitation = {
  id: string;
  heading: string;
  url: string;
};

export type BlogAgentResponseReason =
  | "rate-limited"
  | "provider-unavailable"
  | "generation-disabled";

export type BlogAgentResponse = {
  queryId: string;
  answer: string | null;
  citationIds: string[];
  citations: BlogAgentCitation[];
  insufficientEvidence: boolean;
  usage: {
    cached: boolean;
    reason?: BlogAgentResponseReason;
  };
};

export type PublicMarkdownArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentMarkdown: string;
};
