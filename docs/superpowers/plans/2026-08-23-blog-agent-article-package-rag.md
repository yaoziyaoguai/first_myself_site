# Blog Agent Article Package RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add create-only, Git-audited article packages and Blog-scoped Hybrid RAG without changing simple Markdown publishing or allowing cross-Blog retrieval.

**Architecture:** The publication Skill creates a bounded immutable source snapshot and expected package hash. An authenticated index endpoint validates and embeds it into two PostgreSQL tables, then marks the private Blog ready. Runtime retrieval loads only the ready package for the server-resolved Blog and ranks its bounded chunks in process; otherwise it falls back to Phase 1 Markdown retrieval.

**Tech Stack:** Next.js 16 Route Handlers, Payload CMS 3, PostgreSQL 15 `real[]`, TypeScript, Vitest, Python 3 standard library, DashScope OpenAI-compatible embeddings, DeepSeek OpenAI-compatible chat completions.

**Spec:** `docs/superpowers/specs/2026-08-23-blog-agent-article-package-rag-design.md`

## Global Constraints

- Blog is the only context/security/citation boundary; no cross-Blog query or global knowledge base.
- Simple Markdown stays compatible and uses the existing deterministic fallback.
- Package mode is Git-tracked, clean-at-HEAD, create-only and fail closed.
- Maximum 10 sources, 20 KiB each, 120 KiB total, 128 chunks, 1024 embedding dimensions.
- No pgvector and no global vector/FTS/trigram scan; SQL filters by `blog_id + package_hash` first.
- Do not log secrets, visitor questions, source content, embeddings or provider responses.

---

### Task 1: Persist private package readiness and bounded chunks

**Files:**
- Create: `src/payload/migrations/20260823_000000_add_blog_agent_article_packages.ts`
- Modify: `src/payload/migrations/index.ts`
- Modify: `src/payload/collections/Blog.ts`
- Create: `src/lib/blog-agent/articleIndexRepository.ts`
- Create: `src/lib/blog-agent/articleIndexRepository.postgres.ts`
- Test: `__tests__/payload/blog-agent-article-package-migration.test.ts`
- Test: `__tests__/payload/blog-agent-article-package-migration.postgres.test.ts`
- Test: `__tests__/payload/blog-agent-publication-gate.test.ts`
- Test: `__tests__/lib/blog-agent/articleIndexRepository.postgres.test.ts`

**Interfaces:**
- Produces `ArticlePackageRecord`, `ArticleChunkRecord`, `ArticleIndexRepository.getReadyPackage()`, `replacePackage()` and `getPackageSummary()`.
- Blog private fields are `agentContextRequired`, `agentPackageHash`, `agentIndexStatus`, `agentIndexedPackageHash`, `agentIndexedAt`.

- [ ] **Step 1: Write failing tests** proving migration registration/schema, anonymous field secrecy, the publication gate, transactional replacement, and an exact `WHERE blog_id = $1 AND package_hash = $2` lookup.
- [ ] **Step 2: Run** `npx vitest run __tests__/payload/blog-agent-article-package-migration.test.ts __tests__/payload/blog-agent-publication-gate.test.ts __tests__/lib/blog-agent/articleIndexRepository.postgres.test.ts` and verify failures are missing interfaces/schema.
- [ ] **Step 3: Implement minimal migration, private Blog fields/hooks and repository.** Use `real[]` for embeddings, a composite package/chunk key, check constraints for source kinds/dimensions, and no vector extension.
- [ ] **Step 4: Run the unit tests, then PostgreSQL 15 integration test** with `BLOG_AGENT_TEST_DATABASE_URL`; require zero failures and prove unrelated tables survive `down()`.
- [ ] **Step 5: Commit** `feat: persist scoped article packages`.

### Task 2: Validate, chunk and embed a private article package

**Files:**
- Create: `src/lib/blog-agent/articlePackage.ts`
- Create: `src/lib/blog-agent/embeddingClient.ts`
- Create: `src/lib/blog-agent/articleIndexer.ts`
- Create: `app/api/blog/[id]/agent-index/route.ts`
- Modify: `src/lib/blog-agent/config.ts`
- Test: `__tests__/lib/blog-agent/articlePackage.test.ts`
- Test: `__tests__/lib/blog-agent/embeddingClient.test.ts`
- Test: `__tests__/lib/blog-agent/articleIndexer.test.ts`
- Test: `__tests__/api/blog-agent-index.test.ts`

**Interfaces:**
- Consumes Task 1 repository and private Blog readiness fields.
- Produces `validateArticlePackagePayload()`, `buildArticlePackageChunks()`, `DashScopeEmbeddingClient.embed()`, `ArticleIndexer.index()` and authenticated GET/POST index routes.

- [ ] **Step 1: Write failing validator/chunker tests** for canonical hash verification, allowed kinds, Git-derived metadata shape, path/content/hash mismatch, 10/20KiB/120KiB limits, 128 chunk cap and stable anchors.
- [ ] **Step 2: Run validator tests** and verify expected missing-module failures.
- [ ] **Step 3: Implement deterministic validation and chunking** without network or filesystem access; the endpoint trusts only the already-snapshotted request after server validation.
- [ ] **Step 4: Write failing embedding tests** for endpoint/body, batching, timeout, non-200, row ordering, non-finite values and exact 1024 dimensions.
- [ ] **Step 5: Implement the timeout-bound DashScope client** with `qwen3.7-text-embedding`, `dimensions: 1024`, batch size 10 and no response logging.
- [ ] **Step 6: Write failing indexer/route tests** for admin/editor-only access, 160 KiB body limit, draft/private restriction, expected-hash match, failed-state behavior and ready update only after repository success.
- [ ] **Step 7: Implement indexer and GET/POST route**, deriving Blog identity/content on the server and never accepting a client Blog id/slug/Markdown override.
- [ ] **Step 8: Run all Task 2 tests and targeted ESLint/type-check.**
- [ ] **Step 9: Commit** `feat: index private article packages`.

### Task 3: Retrieve only the current Blog package

**Files:**
- Create: `src/lib/blog-agent/articleRetriever.ts`
- Modify: `src/lib/blog-agent/service.ts`
- Modify: `src/lib/blog-agent/runtime.ts`
- Modify: `src/lib/blog-agent/types.ts`
- Modify: `src/lib/blog-agent/articleMarkdown.ts`
- Test: `__tests__/lib/blog-agent/articleRetriever.test.ts`
- Test: `__tests__/lib/blog-agent/service.test.ts`
- Test: `__tests__/security/blog-agent-adversarial.test.ts`
- Test: `__tests__/lib/blog-agent/runtime.postgres.test.ts`

**Interfaces:**
- Consumes Task 1 ready package/chunks and Task 2 query embedding client.
- Produces `BlogScopedArticleRetriever.prepare(article)` with a package context hash, citation resolver and lazy evidence builder.

- [ ] **Step 1: Write failing retrieval tests** for current `blog_id + article_hash`, dense/lexical fusion, code identifiers, six-chunk/14k bounds, invalid vector fallback and material citations that remain under `/blog/<current-slug>`.
- [ ] **Step 2: Run retrieval tests** and verify missing implementation failures.
- [ ] **Step 3: Implement bounded in-process ranking** over only the repository result; never form a global search query.
- [ ] **Step 4: Write failing service tests** proving cache hits do not call query embeddings, package hash invalidates cache, provider embedding failure falls back lexical/Phase 1, and cached citations cannot escape the current Blog.
- [ ] **Step 5: Integrate the lazy prepared context into service/runtime** while retaining all Phase 1 behavior for articles without a ready package.
- [ ] **Step 6: Run targeted tests plus PostgreSQL runtime integration and adversarial suite.**
- [ ] **Step 7: Commit** `feat: answer from blog scoped rag`.

### Task 4: Upgrade the global publication Skill

**Files:**
- Modify: `/Users/jinkun.wang/.codex/skills/publish-site-article/SKILL.md`
- Modify: `/Users/jinkun.wang/.codex/skills/publish-site-article/references/article-format.md`
- Modify: `/Users/jinkun.wang/.codex/skills/publish-site-article/references/payload-contract.md`
- Modify: `/Users/jinkun.wang/.codex/skills/publish-site-article/scripts/publish_article.py`
- Modify: `/Users/jinkun.wang/.codex/skills/publish-site-article/agents/openai.yaml`
- Create: `/Users/jinkun.wang/.codex/skills/publish-site-article/tests/test_publish_article.py`

**Interfaces:**
- Consumes Task 2 authenticated index endpoint and Task 1 publication gate.
- Adds optional `--package-manifest` to `plan` and `draft`; simple commands remain backward compatible.

- [ ] **Step 1: Write failing Python tests** for sidecar schema, Git-tracked/clean enforcement, path escape/symlink/denied paths, source limits, deterministic hashes, sensitivity scanner, redacted plan output and index call sequencing.
- [ ] **Step 2: Run** `python3 -m unittest discover -s ~/.codex/skills/publish-site-article/tests -v` and verify failures describe missing package mode.
- [ ] **Step 3: Implement package mode in the deterministic script.** Derive `sourceCommit` from `HEAD`, load only manifest-selected UTF-8 files, never print content, set expected private fields on draft, call POST index, and require ready/hash equality in the result.
- [ ] **Step 4: Update Skill instructions/references** so the executing Agent autonomously selects or excludes sources, records reasons, fails closed on ambiguity, never overwrites a slug and preserves Markdown-only mode.
- [ ] **Step 5: Run Python tests and** `python3 /Users/jinkun.wang/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/jinkun.wang/.codex/skills/publish-site-article`.
- [ ] **Step 6: Exercise `plan` against a clean local fixture repo** and verify the JSON contains hashes/paths/counts but no source content or credentials.

### Task 5: Create the my-first-agent experiment article package

**Files:**
- Create in `/Users/jinkun.wang/work_space/my-first-agent`: a new Markdown article under the project documentation convention.
- Create beside it: `<article>.agent.json` sidecar manifest.

**Interfaces:**
- Consumes the upgraded Skill.
- Produces a new create-only Blog draft; it does not modify any existing article.

- [ ] **Step 1: Inspect the canonical my-first-agent repository, its AGENTS/CLAUDE instructions, git status/history and public-safe source files.** Stop if unrelated dirty changes overlap the article/package.
- [ ] **Step 2: Write the new article** around one concrete engineering evolution, not a project inventory; include a deep canary question that needs a selected source.
- [ ] **Step 3: Create the sidecar manifest** with no more than 10 selected sources and explicit exclusions/reasons; run sensitivity review and package `plan`.
- [ ] **Step 4: Commit the article and sidecar in the my-first-agent repository**, rerun package `plan` so every selected file is clean at that commit, and review the rendered Markdown/images.
- [ ] **Step 5: After the new website code is deployed but public Agent flags remain off, create the private draft and index it.** Verify ready/hash equality and run a private/provider canary before publication.
- [ ] **Step 6: Publish only this new slug under the user's existing authorization, verify the public article, then use it for Agent production canary.**

### Task 6: Release controls, documentation and production rollout

**Files:**
- Modify: `.env.example`
- Modify: `.env.docker.prod.example`
- Modify: `docker/docker-compose.prod.yml`
- Modify: `.github/workflows/ci-cd.yml`
- Modify: `scripts/blog-agent-canary.ts`
- Modify: `docs/blog-agent-operations.md`
- Modify: `README.md`
- Modify: `TESTING_GUIDE.md`
- Test: `__tests__/deployment/blog-agent-defaults.test.ts`
- Test: `__tests__/scripts/blog-agent-canary.test.ts`

**Interfaces:**
- Consumes all prior tasks.
- Produces safe GitHub-to-Aliyun deployment, private indexing instructions, scoped RAG canary and rollback/disable steps.

- [ ] **Step 1: Write failing configuration/deployment tests** for server-only embedding env, false-by-default feature flags, migration ordering and no secret exposure in build args/client code.
- [ ] **Step 2: Implement configuration/docs/canary updates**, keeping first deployment flags false and passing secrets only as runtime env.
- [ ] **Step 3: Run full gates:** `npm run lint`, `npx tsc --noEmit -p tsconfig.ci.json`, `npm test`, PostgreSQL integration suite, `npm audit --audit-level=high`, `npm run build`, skill Python tests/validator and browser desktop/mobile QA.
- [ ] **Step 4: Review the full diff against the spec**, fix correctness/security/data/reliability/performance/API/accessibility findings, and rerun the smallest reproducer plus full gates.
- [ ] **Step 5: Push `codex/blog-agent-v1`, open a PR, self-review every changed file, wait for required GitHub checks and merge only when green.**
- [ ] **Step 6: Verify the first Aliyun deploy with flags off** using container health, domain/TLS, migrations and private package indexing.
- [ ] **Step 7: Set reviewed GitHub variables for Agent/RAG enablement, redeploy through the same main-branch workflow, then run scoped answer, citation, cache and abuse canaries.** Disable flags immediately on any boundary or budget failure.
- [ ] **Step 8: Rotate both provider keys exposed in chat after production verification**, replace GitHub secrets and re-run canary without printing either key.

## Plan self-review

- Spec coverage: simple Markdown fallback, create-only package, private fields, authenticated index, scoped SQL, provider fallback, citations, cache invalidation, Skill, experiment, CI/CD and rotation each map to a task.
- Placeholder scan: no `TBD`, speculative subsystem, global knowledge base, reranker, conversation history or live coding-agent connector is included.
- Type consistency: `packageHash` is the publication/index/cache version; `articleHash` binds the snapshot to current Blog content; `blog_id + package_hash` is the only chunk lookup key.
