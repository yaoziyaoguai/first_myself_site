# Owner-Aware Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark authenticated admin/editor page views as owner traffic and retain only a masked network prefix for every visit.

**Architecture:** Request identity derives an irreversible visitor fingerprint and a display-safe network prefix from the same trusted proxy address. The analytics route authenticates the existing Payload cookie server-side and passes a closed identity object to one conflict-safe page-view upsert. Existing summaries exclude owner traffic by default.

**Tech Stack:** TypeScript, Next.js 16, Payload CMS 3, PostgreSQL 15, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-26-agent-quality-operations-design.md`

## Global Constraints

- Never persist a complete IPv4 or IPv6 address.
- IPv4 output is `/24` display form such as `182.92.85.*`; IPv6 output is a normalized `/64` prefix.
- Only a valid Payload admin/editor session marks `isOwner=true`; a matching network never does.
- Existing visitor HMAC and session conflict protection remain unchanged.
- Analytics summaries exclude owner visits by default; migrations remain backward-compatible.

---

### Task 1: Mask network prefixes in request identity

**Files:**
- Modify: `src/lib/requestIdentity.ts`
- Create: `__tests__/lib/requestIdentity.test.ts`

**Interfaces:**
- Produces: `maskNetworkPrefix(address: string): string` and `RequestIdentity.networkPrefix`.
- Consumes: the trusted address returned by existing `getClientIp(request)`.

- [ ] **Step 1: Write failing pure-function tests**

Cover valid IPv4, boundary octets, compressed and expanded IPv6, IPv4-mapped IPv6, zone/port garbage, `unknown`, malformed addresses, and uppercase hextets. Assert that the original complete address never appears in the output.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run __tests__/lib/requestIdentity.test.ts`

Expected: FAIL because `maskNetworkPrefix` and `networkPrefix` do not exist.

- [ ] **Step 3: Implement masking without a new dependency**

Use `node:net` `isIP`. For IPv4 return the first three validated decimal octets plus `.*`. Expand IPv6 `::` into eight hextets, convert an optional dotted tail to two hextets, normalize the first four hextets without leading zeroes, and return `<four-groups>::/64`. Return an empty string for invalid input.

- [ ] **Step 4: Run focused test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/requestIdentity.ts __tests__/lib/requestIdentity.test.ts
git commit -m "feat: derive masked visitor networks"
```

### Task 2: Persist owner and network fields

**Files:**
- Create: `src/payload/migrations/20260826_010000_add_owner_analytics_fields.ts`
- Modify: `src/payload/migrations/index.ts`
- Modify: `src/payload/collections/PageViews.ts`
- Create: `__tests__/payload/owner-analytics-migration.test.ts`
- Modify: `__tests__/payload/pageViews.test.ts`

**Interfaces:**
- Produces: nullable `network_prefix` and non-null `is_owner boolean default false` columns.
- Consumes: existing `page_views` collection/table.

- [ ] **Step 1: Write failing migration and collection tests**

Assert idempotent `ADD COLUMN IF NOT EXISTS`, an owner/created-time index, safe `down` column removal, read-only Payload fields, and list columns that expose the masked prefix and owner marker to admin/editor users.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run \
  __tests__/payload/owner-analytics-migration.test.ts \
  __tests__/payload/pageViews.test.ts
```

Expected: FAIL because the migration and fields do not exist.

- [ ] **Step 3: Implement additive schema and collection fields**

Add `networkPrefix` as read-only text labelled `脱敏网段`, and `isOwner` as read-only checkbox labelled `站长访问`. Existing rows default to non-owner and may have an empty prefix.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/payload/migrations src/payload/collections/PageViews.ts \
  __tests__/payload/owner-analytics-migration.test.ts __tests__/payload/pageViews.test.ts
git commit -m "feat: add owner-aware analytics fields"
```

### Task 3: Authenticate analytics requests and upsert the closed identity

**Files:**
- Modify: `app/api/analytics/route.ts`
- Modify: `src/lib/analytics.server.ts`
- Modify: `__tests__/api/analytics.test.ts`
- Modify: `__tests__/lib/analytics.server.test.ts`

**Interfaces:**
- Produces: `AnalyticsIdentity = { visitorHash: string; networkPrefix: string; isOwner: boolean }` passed to `recordPageView` and `updatePageView`.
- Consumes: `getPayloadAPI().auth({ headers: request.headers })` and `deriveRequestIdentity(request)`.

- [ ] **Step 1: Write failing route and SQL tests**

Assert admin/editor auth sets owner, anonymous/auth failures do not, the client cannot forge either field, and owner authentication failure does not reject analytics. Assert upsert parameter order includes masked prefix and owner, heartbeat keeps the original visitor conflict condition, `network_prefix` updates from the current request, and `is_owner` is monotonic with `page_views.is_owner OR EXCLUDED.is_owner`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run __tests__/api/analytics.test.ts __tests__/lib/analytics.server.test.ts
```

Expected: FAIL because the functions still accept only a visitor hash.

- [ ] **Step 3: Implement server-owned identity flow**

Define:

```ts
export type AnalyticsIdentity = {
  visitorHash: string;
  networkPrefix: string;
  isOwner: boolean;
};
```

Authenticate after request validation and rate limiting. Treat any auth exception as anonymous. Never accept owner/network fields from the body. Keep one atomic upsert.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/analytics/route.ts src/lib/analytics.server.ts \
  __tests__/api/analytics.test.ts __tests__/lib/analytics.server.test.ts
git commit -m "feat: distinguish owner analytics traffic"
```

### Task 4: Exclude owner traffic from summaries

**Files:**
- Modify: `src/lib/analytics.server.ts`
- Modify: `__tests__/lib/analytics.server.test.ts`
- Modify: `src/payload/components/AnalyticsSummary/index.tsx`

**Interfaces:**
- Consumes: persisted `is_owner` flag.
- Produces: existing `readAnalyticsSummary` return type with all aggregates and top pages computed only from `is_owner = false`.

- [ ] **Step 1: Add a failing summary SQL test**

Assert both totals and top-pages queries contain the owner exclusion and that the UI copy states that logged-in owner visits are excluded.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run __tests__/lib/analytics.server.test.ts`

Expected: FAIL because current SQL includes all visits.

- [ ] **Step 3: Add the owner filter and copy**

Use `COALESCE(is_owner, false) = false` in both queries for compatibility during rollout. Do not change metric names or introduce an interactive toggle.

- [ ] **Step 4: Run focused test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics.server.ts src/payload/components/AnalyticsSummary/index.tsx \
  __tests__/lib/analytics.server.test.ts
git commit -m "feat: exclude owner visits from analytics"
```
