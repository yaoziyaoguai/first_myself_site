import { describe, expect, it } from "vitest";
import { createModelCacheKey } from "@/lib/blog-agent/runtime";

describe("createModelCacheKey", () => {
  it("changes when the provider, model, or actual system prompt changes", () => {
    const config = { baseUrl: "https://models.example/v1", model: "model-a" };
    const baseline = createModelCacheKey(config, "prompt-a");

    expect(createModelCacheKey(config, "prompt-b")).not.toBe(baseline);
    expect(createModelCacheKey({ ...config, model: "model-b" }, "prompt-a"))
      .not.toBe(baseline);
    expect(createModelCacheKey({ ...config, baseUrl: "https://other.example/v1" }, "prompt-a"))
      .not.toBe(baseline);
  });
});
