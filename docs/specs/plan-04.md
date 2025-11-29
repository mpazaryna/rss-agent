# TDD Implementation Plan: Phase 4 - Workers AI Summarization

## Overview

Phase 4 adds AI-powered summarization to the rss-agent worker using Cloudflare Workers AI. This transforms the system from a feed fetcher into an intelligent content processor - the original vision from rss-ai, now running at the edge.

**Goal:** AI-enhanced feed processing with article summarization

**Key Deliverables:**
- Workers AI binding configured
- `/summarize` endpoint for single article summarization
- `/batch` enhanced with optional summarization
- Summary caching in KV
- Updated agent with summarization capabilities

## Architecture for Phase 4

```
rss-agent/
├── worker/
│   ├── src/
│   │   ├── index.ts          # Add /summarize route
│   │   ├── summarize.ts      # NEW: Workers AI integration
│   │   ├── fetch.ts          # Existing
│   │   ├── parse.ts          # Existing
│   │   └── cache.ts          # Extend for summary caching
│   └── wrangler.toml         # Add [ai] binding
├── agents/
│   └── feed-fetch.md         # Update with summarization
├── config/                   # Existing
└── test/
    ├── summarize.test.ts     # NEW: Unit tests
    └── agent/
        └── summarize-integration.test.ts  # NEW
```

## Workers AI Configuration

### wrangler.toml addition
```toml
[ai]
binding = "AI"
```

### Model Selection

**Primary model:** `@cf/meta/llama-3.1-8b-instruct-fast`
- Fast inference for summarization
- Good balance of quality and latency
- Multilingual support

**Fallback for longer content:** `@cf/facebook/bart-large-cnn`
- Purpose-built for summarization
- Better for longer articles

---

## Test-First Implementation Sequence

### 1. Workers AI Binding - Test First

**Write failing tests for:**
- Worker has AI binding available
- AI binding can be invoked
- Binding returns expected response structure

**Implement to pass:**
- Add `[ai]` section to wrangler.toml
- Update Env type with AI binding
- Verify binding works in dev environment

**Refactor:**
- Add AI types to types.ts

---

### 2. Basic Summarization Function - Test First

**Write failing tests for:**
- `summarizeText(text)` returns summary string
- Summary is shorter than input
- Empty input returns error
- Very long input is truncated before sending to AI
- Function handles AI errors gracefully

**Implement to pass:**
- Create `src/summarize.ts`
- Implement `summarizeText()` using Workers AI
- Add prompt engineering for consistent summaries

**Refactor:**
- Extract prompt templates to constants
- Add summary length options (brief, detailed)

---

### 3. Article Fetching for Summarization - Test First

**Write failing tests for:**
- Fetch article content from URL
- Extract main text content (strip HTML)
- Handle non-HTML responses
- Respect robots.txt / rate limits
- Return error for inaccessible URLs

**Implement to pass:**
- Create `fetchArticleContent()` function
- Add HTML-to-text extraction
- Implement content length limits

**Refactor:**
- Reuse fetch utilities from existing fetch.ts

---

### 4. `/summarize` Endpoint - Test First

**Write failing tests for:**
- `POST /summarize` with URL returns summary
- Response includes: `summary`, `title`, `url`, `meta`
- Request with `style` parameter (brief/detailed/bullets)
- Cached summaries return `cached: true`
- Invalid URL returns 400
- Inaccessible URL returns 404
- Non-article content returns 422

**Implement to pass:**
- Add `/summarize` route to index.ts
- Wire up fetch → extract → summarize → cache flow
- Return structured response

**Request:**
```json
{
  "url": "https://blog.cloudflare.com/some-article",
  "style": "brief"  // optional: "brief" | "detailed" | "bullets"
}
```

**Response:**
```json
{
  "success": true,
  "summary": "Two-sentence summary of the article...",
  "title": "Article Title",
  "url": "https://blog.cloudflare.com/some-article",
  "meta": {
    "model": "llama-3.1-8b-instruct-fast",
    "style": "brief",
    "cached": false,
    "summarizedAt": "2025-11-29T12:00:00Z"
  }
}
```

**Refactor:**
- Add summary style presets

---

### 5. Summary Caching - Test First

**Write failing tests for:**
- Summary stored in KV after generation
- Cache key: `summary:{sha256(url)}:{style}`
- Cached summary returned on repeat request
- Cache TTL is 24 hours (longer than feed cache)
- Force refresh bypasses cache

**Implement to pass:**
- Extend cache.ts with summary caching functions
- Integrate caching into /summarize endpoint

**Refactor:**
- Unify cache key generation patterns

---

### 6. Batch Summarization - Test First

**Write failing tests for:**
- `/batch` with `summarize: true` includes summaries
- Summarization runs in parallel with fetching
- Failed summarizations don't fail the whole batch
- Response includes per-item summary status
- Respects rate limits on AI calls

**Implement to pass:**
- Add `summarize` option to /batch endpoint
- Integrate summarization into batch flow
- Add summary fields to batch response

**Enhanced /batch request:**
```json
{
  "feeds": [{"url": "..."}],
  "summarize": true,
  "summaryStyle": "brief",
  "limit": 5
}
```

**Refactor:**
- Extract parallel execution patterns

---

### 7. Topic Extraction - Test First

**Write failing tests for:**
- Extract topics/tags from article content
- Return 3-5 relevant topics
- Topics are normalized (lowercase, trimmed)
- Works alongside summarization

**Implement to pass:**
- Add topic extraction to summarize flow
- Use AI to identify key themes
- Add topics to response

**Response addition:**
```json
{
  "topics": ["ai", "cloudflare", "edge-computing"]
}
```

**Refactor:**
- Consider single AI call for summary + topics

---

### 8. Agent Update - Test First

**Write failing tests for:**
- Agent definition includes summarization capabilities
- Agent can call /summarize endpoint
- Agent can request batch with summaries
- Agent formats summaries in markdown

**Implement to pass:**
- Update agents/feed-fetch.md with new capabilities
- Add summarization examples
- Document new interaction patterns

**Refactor:**
- Consider separate feed-summarize.md agent

---

### 9. E2E Summarization Tests - Test First

**Write failing tests for:**
- Summarize a real article from deployed worker
- Batch fetch with summarization enabled
- Verify summary quality (non-empty, reasonable length)
- Caching works on deployed worker

**Implement to pass:**
- Add e2e tests to test/e2e/
- Test against dev worker with AI binding

**Refactor:**
- Add summary quality assertions

---

## API Reference

### `POST /summarize`

Summarize a single article.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | yes | Article URL to summarize |
| style | string | no | "brief" (default), "detailed", "bullets" |
| forceRefresh | boolean | no | Bypass cache |

### `POST /batch` (enhanced)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| feeds | array | yes | Feed URLs to fetch |
| summarize | boolean | no | Include AI summaries |
| summaryStyle | string | no | Style for summaries |
| since | string | no | Date filter |
| limit | number | no | Items per feed |

---

## Error Handling

| Error | Code | When |
|-------|------|------|
| `invalid_url` | 400 | Malformed URL |
| `article_not_found` | 404 | URL returns 404 |
| `content_extraction_failed` | 422 | Can't extract text |
| `summarization_failed` | 500 | AI model error |
| `rate_limited` | 429 | Too many AI requests |

---

## Completion Criteria

**All tests passing:**
- [ ] Workers AI binding tests
- [ ] Summarization function tests
- [ ] Article fetching tests
- [ ] /summarize endpoint tests
- [ ] Summary caching tests
- [ ] Batch summarization tests
- [ ] Topic extraction tests
- [ ] Agent update tests
- [ ] E2E summarization tests

**TDD cycle followed:**
- [ ] Each component had tests written first
- [ ] No implementation without failing tests
- [ ] Refactoring performed after green tests

**Phase 4 requirements met:**
- [ ] Workers AI binding configured and working
- [ ] `/summarize` endpoint returns AI summaries
- [ ] Summaries cached in KV (24h TTL)
- [ ] `/batch` supports optional summarization
- [ ] Topics extracted from articles
- [ ] Agent updated with summarization capabilities
- [ ] "Summarize this week's AI news" works end-to-end

---

## Notes

- Workers AI has generous free tier (10,000 neurons/day)
- Llama 3.1 8B is fast enough for real-time summarization
- Cache summaries longer than feeds (content doesn't change)
- Consider cost monitoring for AI usage
- May need to chunk very long articles

---

**Document Version:** 1.0
**Created:** November 29, 2025
**Dependencies:** Phases 1-3 complete
**Estimated Effort:** 4-6 hours
