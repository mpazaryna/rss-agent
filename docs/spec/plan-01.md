# TDD Implementation Plan: RSS Agent Cloudflare Worker

## Overview
RSS Agent is a Cloudflare Worker that provides a stateless RSS fetching and parsing service. This plan covers Phase 1 (Minimal Worker) and Phase 2 (Caching & Reliability), establishing the core `/health`, `/fetch`, and `/batch` endpoints with KV caching.

**Key Deliverables:**
- Cloudflare Worker with `/health`, `/fetch`, and `/batch` endpoints
- RSS 2.0 and Atom feed parsing
- KV-based caching with TTL support
- Error handling for all failure modes
- Rate limiting

## Test-First Implementation Sequence

### 1. Project Setup & Health Endpoint - Test First
**Write failing tests for:**
- Worker responds to `GET /health` with 200 status
- Response includes `status: "ok"`, `version`, and `timestamp` fields
- Response timestamp is valid ISO 8601 format

**Implement to pass:**
- Initialize worker project with `wrangler init`
- Create `src/index.ts` with basic request routing
- Implement `/health` endpoint returning required JSON structure

**Refactor:**
- Extract response types to `src/types.ts`

---

### 2. URL Validation - Test First
**Write failing tests for:**
- Valid HTTP/HTTPS URLs pass validation
- Invalid URLs (empty, malformed, non-http protocols) return 400 `invalid_url` error
- URLs without protocol are rejected
- Excessively long URLs are rejected

**Implement to pass:**
- Create `src/validate.ts` with URL validation function
- Return structured error responses with `error` and `message` fields

**Refactor:**
- Define error response types in `src/types.ts`

---

### 3. RSS 2.0 Parsing - Test First
**Write failing tests for:**
- Parse valid RSS 2.0 XML and extract feed metadata (title, url, description, lastUpdated)
- Extract items with title, url, published, summary, author, categories
- Handle feeds with missing optional fields gracefully
- Return 422 `parse_error` for malformed XML
- Return 422 `parse_error` for XML that isn't RSS format

**Implement to pass:**
- Create `src/parse.ts` with RSS 2.0 parser
- Use XML parsing (consider lightweight parser or regex for minimal implementation)
- Map RSS elements to response schema

**Refactor:**
- Extract feed and item types to `src/types.ts`

---

### 4. Atom Feed Parsing - Test First
**Write failing tests for:**
- Parse valid Atom XML and extract feed metadata
- Extract entries with title, url, published, summary, author, categories
- Distinguish between Atom and RSS formats automatically
- Handle Atom-specific fields (id, link with rel="alternate")

**Implement to pass:**
- Extend `src/parse.ts` with Atom parser
- Add format detection logic
- Normalize Atom entries to common item schema

**Refactor:**
- Unify RSS and Atom parsing through common interface

---

### 5. Feed Fetching - Test First
**Write failing tests for:**
- Fetch feed from valid URL and return parsed content
- Return 404 `feed_not_found` for non-existent URLs
- Return 504 `timeout` when fetch exceeds timeout threshold
- Handle redirects appropriately
- Set appropriate User-Agent header

**Implement to pass:**
- Create `src/fetch.ts` with fetch logic using `fetch()` API
- Implement timeout handling with `AbortController`
- Map HTTP errors to appropriate error responses

**Refactor:**
- Extract timeout configuration to constants

---

### 6. `/fetch` Endpoint Integration - Test First
**Write failing tests for:**
- `POST /fetch` with valid URL returns parsed feed
- Request with `since` parameter filters items by date
- Request with `limit` parameter caps item count
- Response includes `meta.fetchedAt`, `meta.cached`, `meta.itemCount`
- Invalid request body returns 400

**Implement to pass:**
- Wire up `/fetch` route in `src/index.ts`
- Integrate validation, fetching, and parsing
- Implement `since` date filtering
- Implement `limit` truncation

**Refactor:**
- Extract request parsing to helper function

---

### 7. KV Cache - Read Operations - Test First
**Write failing tests for:**
- Cache miss returns null/undefined
- Cache hit returns stored feed data
- Cache respects TTL (expired entries treated as miss)
- Cache key is `feed:{sha256(url)}:content`

**Implement to pass:**
- Create `src/cache.ts` with cache read function
- Implement SHA256 URL hashing
- Configure KV binding in `wrangler.toml`

**Refactor:**
- Extract cache key generation to utility function

---

### 8. KV Cache - Write Operations - Test First
**Write failing tests for:**
- Store feed data in cache with TTL
- Store ETag in separate key `feed:{hash}:etag`
- Store Last-Modified in `feed:{hash}:modified`
- Default TTL is 15 minutes

**Implement to pass:**
- Add cache write function to `src/cache.ts`
- Store metadata for conditional requests

**Refactor:**
- Define cache TTL as configurable constant

---

### 9. Conditional Requests - Test First
**Write failing tests for:**
- Include `If-None-Match` header when ETag cached
- Include `If-Modified-Since` header when Last-Modified cached
- 304 response returns cached data without re-parsing
- Update cache on 200 response with new content

**Implement to pass:**
- Extend `src/fetch.ts` to use conditional headers
- Handle 304 responses by returning cached content
- Update `meta.cached` flag appropriately

**Refactor:**
- Consolidate cache check and conditional fetch logic

---

### 10. `/fetch` with Caching - Test First
**Write failing tests for:**
- First request fetches and caches
- Second request within TTL returns cached (meta.cached: true)
- Request after TTL expiry re-fetches
- Force refresh option bypasses cache

**Implement to pass:**
- Integrate cache into `/fetch` endpoint flow
- Check cache before fetch, store after successful fetch

**Refactor:**
- Extract cache-then-fetch pattern to reusable function

---

### 11. Rate Limiting - Test First
**Write failing tests for:**
- Requests within rate limit succeed
- Requests exceeding limit return 429 `rate_limited`
- Response includes `retryAfter` seconds
- Rate limit resets after window expires

**Implement to pass:**
- Create `src/ratelimit.ts` with rate limiting logic
- Use KV or in-memory counter for request tracking
- Apply rate limit middleware to endpoints

**Refactor:**
- Make rate limit configurable per endpoint

---

### 12. `/batch` Endpoint - Test First
**Write failing tests for:**
- `POST /batch` accepts array of feed URLs
- Fetches all feeds in parallel
- Returns results array with per-feed success/error
- Response includes `meta.totalFeeds`, `successCount`, `failureCount`, `totalItems`
- Applies `since` and `limit` parameters to all feeds
- Handles shorthand `since` values ("24h", "7d", "30d")

**Implement to pass:**
- Add `/batch` route to `src/index.ts`
- Use `Promise.all` or `Promise.allSettled` for parallel fetches
- Aggregate results and compute meta statistics

**Refactor:**
- Share filtering/limiting logic with `/fetch`

---

### 13. Error Response Consistency - Test First
**Write failing tests for:**
- All error responses follow schema: `{ error: string, message: string }`
- 400 errors include descriptive message
- 404 errors include attempted URL
- 422 errors include parse failure details
- 429 errors include `retryAfter` field
- 504 errors include timeout duration

**Implement to pass:**
- Create error response factory in `src/errors.ts`
- Standardize all error responses across endpoints

**Refactor:**
- Use error factory consistently throughout codebase

---

### 14. End-to-End Tests (Post-Deployment) - REQUIRED
**Prerequisites:**
- Worker deployed to Cloudflare (staging or production)
- Deployment URL available

**Write e2e tests for:**
- `GET /health` returns expected response from deployed worker
- `POST /fetch` successfully fetches and parses a real RSS feed
- `POST /fetch` successfully fetches and parses a real Atom feed
- `POST /fetch` with `since` parameter filters results correctly
- `POST /fetch` with `limit` parameter caps results correctly
- `POST /batch` fetches multiple real feeds in parallel
- Error responses match expected schema for invalid inputs
- Caching behavior works correctly (second request returns cached: true)
- Rate limiting triggers 429 when threshold exceeded

**Implement:**
- Create `test/e2e/` directory for e2e test files
- Use test runner (Vitest) with real HTTP requests to deployed URL
- Configure deployment URL via environment variable
- Add npm script: `npm run test:e2e`

**Notes:**
- Unit/integration tests (Steps 1-13) use Miniflare for local simulation
- E2E tests validate actual Cloudflare deployment behavior
- E2E tests should run against staging before production deploy
- E2E tests are required before considering the worker production-ready

---

## Completion Criteria

**All tests passing:**
- [x] Unit tests for URL validation (11 tests)
- [x] Unit tests for RSS 2.0 parsing (15 tests)
- [x] Unit tests for Atom parsing (17 tests)
- [x] Unit tests for feed fetching (11 tests)
- [x] Unit tests for KV cache operations (17 tests)
- [x] Unit tests for rate limiting (9 tests)
- [x] Integration tests for `/health` endpoint (5 tests)
- [x] Integration tests for `/fetch` endpoint (12 + 6 caching tests)
- [x] Integration tests for `/batch` endpoint (18 tests)
- [x] Integration tests for caching behavior (9 conditional + 6 endpoint tests)
- [x] E2E tests against deployed worker (11 tests)

**TDD cycle followed:**
- [x] Each component had tests written first
- [x] No implementation without failing tests
- [x] Refactoring performed after green tests

**Spec requirements met:**
- [x] `/health` returns status, version, timestamp
- [x] `/fetch` parses RSS 2.0 and Atom feeds
- [x] `/fetch` supports `since` and `limit` parameters
- [x] `/batch` fetches multiple feeds in parallel
- [x] KV caching with 15-minute default TTL
- [x] ETag/Last-Modified conditional request support
- [x] Error responses: 400, 404, 422, 429, 504
- [x] Rate limiting with retryAfter
- [x] Response schema matches spec exactly

## Deployment Status

**Environments configured:**
- [x] Production KV namespace created
- [x] Staging KV namespace created
- [x] Dev KV namespace created

**Deployed:**
- [x] Dev environment: https://rss-agent-dev.mpazbot.workers.dev
- [ ] Staging environment
- [ ] Production environment

**Test Results:**
- Unit/Integration: 148 passing tests
- E2E: 11 passing tests
- **Total: 159 tests**
