export interface ArticleEmbeddingClient {
  embed(inputs: string[]): Promise<number[][]>;
}

type DashScopeEmbeddingClientConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions: number;
  timeoutMs?: number;
  fetcher?: typeof fetch;
};

const MAX_BATCH_SIZE = 10;

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/g, "")}/embeddings`;
}

function parseBatch(body: unknown, count: number, dimensions: number): number[][] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Embedding provider returned invalid JSON");
  }
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length !== count) {
    throw new Error("Embedding provider returned an invalid row count");
  }
  const rows: Array<number[] | undefined> = Array.from({ length: count });
  for (const raw of data) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Embedding provider returned an invalid row");
    }
    const row = raw as { index?: unknown; embedding?: unknown };
    if (!Number.isInteger(row.index) || Number(row.index) < 0 || Number(row.index) >= count) {
      throw new Error("Embedding provider returned an invalid index");
    }
    if (!Array.isArray(row.embedding) || row.embedding.length !== dimensions) {
      throw new Error("Embedding provider returned invalid dimensions");
    }
    const embedding = row.embedding.map(Number);
    if (!embedding.every(Number.isFinite) || rows[Number(row.index)]) {
      throw new Error("Embedding provider returned an invalid vector");
    }
    rows[Number(row.index)] = embedding;
  }
  if (rows.some((row) => !row)) throw new Error("Embedding provider omitted a row");
  return rows as number[][];
}

export class DashScopeEmbeddingClient implements ArticleEmbeddingClient {
  constructor(private readonly config: DashScopeEmbeddingClientConfig) {}

  async embed(inputs: string[]): Promise<number[][]> {
    if (inputs.length === 0) return [];
    const result: number[][] = [];
    for (let start = 0; start < inputs.length; start += MAX_BATCH_SIZE) {
      const batch = inputs.slice(start, start + MAX_BATCH_SIZE);
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs ?? 15_000,
      );
      try {
        const response = await (this.config.fetcher ?? fetch)(endpoint(this.config.baseUrl), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.config.model,
            input: batch,
            dimensions: this.config.dimensions,
            encoding_format: "float",
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Embedding provider returned status ${response.status}`);
        }
        result.push(...parseBatch(
          await response.json(),
          batch.length,
          this.config.dimensions,
        ));
      } finally {
        clearTimeout(timeout);
      }
    }
    return result;
  }
}
