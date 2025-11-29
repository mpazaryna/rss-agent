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

## Completion Criteria

**All tests passing:**
- [ ] Unit tests for URL validation
- [ ] Unit tests for RSS 2.0 parsing
- [ ] Unit tests for Atom parsing
- [ ] Unit tests for feed fetching
- [ ] Unit tests for KV cache operations
- [ ] Unit tests for rate limiting
- [ ] Integration tests for `/health` endpoint
- [ ] Integration tests for `/fetch` endpoint
- [ ] Integration tests for `/batch` endpoint
- [ ] Integration tests for caching behavior

**TDD cycle followed:**
- [ ] Each component had tests written first
- [ ] No implementation without failing tests
- [ ] Refactoring performed after green tests

**Spec requirements met:**
- [ ] `/health` returns status, version, timestamp
- [ ] `/fetch` parses RSS 2.0 and Atom feeds
- [ ] `/fetch` supports `since` and `limit` parameters
- [ ] `/batch` fetches multiple feeds in parallel
- [ ] KV caching with 15-minute default TTL
- [ ] ETag/Last-Modified conditional request support
- [ ] Error responses: 400, 404, 422, 429, 504
- [ ] Rate limiting with retryAfter
- [ ] Response schema matches spec exactly
