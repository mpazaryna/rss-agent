---
title: RSS Agent - Features
type: feature-catalog
generated: 2025-11-30
last_updated: 2025-11-30
project: rss-agent
status: current
---

# RSS Agent - Features

This document catalogs all implemented features in the RSS Agent project, organized by capability area.

[← Back to MOC](./README.md)

## Feature Overview

RSS Agent provides five core capabilities:

1. **Health Monitoring** - Service health checks
2. **Feed Fetching** - Single and batch RSS feed retrieval with caching
3. **AI Summarization** - Article summarization with topic extraction
4. **Digest Generation** - Complete fetch → summarize → format pipeline
5. **Rate Limiting** - Per-client request throttling

## 1. Health Monitoring

### GET /health

Service health check endpoint for monitoring and uptime verification.

**Implementation:** [worker/src/index.ts:758-765](../../worker/src/index.ts)

**Request:**
```http
GET /health HTTP/1.1
Host: rss-agent.mpazbot.workers.dev
```

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2025-11-30T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK` - Service is healthy

**Use Cases:**
- Uptime monitoring
- Load balancer health checks
- Deployment verification

---

## 2. Feed Fetching

### 2.1 Single Feed Fetch - POST /fetch

Fetches and parses a single RSS feed with optional filtering and caching.

**Implementation:** [worker/src/index.ts:208-287](../../worker/src/index.ts)

**Request:**
```http
POST /fetch HTTP/1.1
Host: rss-agent.mpazbot.workers.dev
Content-Type: application/json

{
  "url": "https://huggingface.co/blog/feed.xml",
  "since": "7d",
  "limit": 5,
  "forceRefresh": false
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | Yes | - | RSS feed URL |
| `since` | string | No | - | Filter items by date (ISO or shorthand: 24h, 7d) |
| `limit` | number | No | - | Max items to return |
| `forceRefresh` | boolean | No | false | Bypass cache |

**Response:**
```json
{
  "success": true,
  "feed": {
    "title": "Hugging Face Blog",
    "url": "https://huggingface.co",
    "description": "Latest news and updates",
    "lastUpdated": "2025-11-30T10:00:00Z"
  },
  "items": [
    {
      "title": "Introducing FLUX-2",
      "url": "https://huggingface.co/blog/flux-2",
      "published": "2025-11-25T09:00:00Z",
      "summary": "FLUX.2 is the latest...",
      "author": "John Doe",
      "categories": ["ai", "models"]
    }
  ],
  "meta": {
    "fetchedAt": "2025-11-30T12:00:00Z",
    "cached": true,
    "itemCount": 5
  }
}
```

**Capabilities:**
- RSS 2.0 and Atom feed parsing
- Conditional requests (ETag, If-Modified-Since)
- 15-minute cache TTL
- Date filtering with shorthand (24h, 7d, 30d)
- Item count limiting

**Related Components:**
- [fetch.ts](../../worker/src/fetch.ts) - Feed fetching logic
- [parse.ts](../../worker/src/parse.ts) - RSS/Atom parsing
- [cache.ts](../../worker/src/cache.ts) - KV caching
- [validate.ts](../../worker/src/validate.ts) - URL validation

---

### 2.2 Batch Feed Fetch - POST /batch

Fetches multiple RSS feeds in parallel with optional AI summarization.

**Implementation:** [worker/src/index.ts:289-450](../../worker/src/index.ts)

**Request:**
```http
POST /batch HTTP/1.1
Host: rss-agent.mpazbot.workers.dev
Content-Type: application/json

{
  "feeds": [
    { "url": "https://huggingface.co/blog/feed.xml" },
    { "url": "https://openai.com/blog/rss.xml" }
  ],
  "since": "24h",
  "limit": 3,
  "summarize": true,
  "summaryStyle": "brief"
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `feeds` | array | Yes | - | Array of feed objects with `url` property |
| `since` | string | No | - | Filter items by date |
| `limit` | number | No | - | Max items per feed |
| `summarize` | boolean | No | false | Enable AI summarization |
| `summaryStyle` | string | No | "brief" | Summary style: brief, detailed, bullets |

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "url": "https://huggingface.co/blog/feed.xml",
      "success": true,
      "feed": {
        "title": "Hugging Face Blog",
        "url": "https://huggingface.co"
      },
      "items": [...]
    },
    {
      "url": "https://openai.com/blog/rss.xml",
      "success": true,
      "feed": {
        "title": "OpenAI Blog",
        "url": "https://openai.com"
      },
      "items": [...]
    }
  ],
  "meta": {
    "totalFeeds": 2,
    "successCount": 2,
    "failureCount": 0,
    "totalItems": 6,
    "summarizedCount": 6
  }
}
```

**Capabilities:**
- Parallel feed fetching (Promise.all)
- Individual feed error isolation
- Optional AI summarization per item
- Summary caching (24h TTL)
- Aggregated success/failure metrics

**Performance:**
- All feeds fetched concurrently
- Cache hits reduce latency significantly
- AI summarization adds ~1-2s per uncached article

---

## 3. AI Summarization

### POST /summarize

Generates AI-powered summaries of article content with topic extraction.

**Implementation:** [worker/src/index.ts:628-752](../../worker/src/index.ts)

**Request:**
```http
POST /summarize HTTP/1.1
Host: rss-agent.mpazbot.workers.dev
Content-Type: application/json

{
  "url": "https://huggingface.co/blog/flux-2",
  "style": "brief",
  "forceRefresh": false
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | Yes | - | Article URL to summarize |
| `style` | string | No | "brief" | Summary style: brief (1-2 sentences), detailed (paragraph), bullets (3-5 points) |
| `forceRefresh` | boolean | No | false | Bypass summary cache |

**Response:**
```json
{
  "success": true,
  "summary": "FLUX.2 is Black Forest Labs' new image generation model offering improved quality and faster inference compared to previous versions.",
  "title": "Diffusers welcomes FLUX-2",
  "url": "https://huggingface.co/blog/flux-2",
  "topics": ["image-generation", "diffusion-models", "flux", "ai-models"],
  "meta": {
    "model": "@cf/mistralai/mistral-small-3.1-24b-instruct",
    "style": "brief",
    "summarizedAt": "2025-11-30T12:00:00Z",
    "cached": true
  }
}
```

**Capabilities:**
- Article content extraction from URL
- AI summarization with configurable styles
- Topic extraction (3-5 key topics)
- 24-hour summary caching
- Parallel AI operations (summary + topics)

**Summary Styles:**

| Style | Description | Example Use Case |
|-------|-------------|------------------|
| `brief` | 1-2 sentences | Quick scan, email subject lines |
| `detailed` | Full paragraph | Comprehensive understanding |
| `bullets` | 3-5 bullet points | Executive summaries, presentations |

**AI Model:**
- Primary: `@cf/mistralai/mistral-small-3.1-24b-instruct`
- Context window: 128k tokens
- Max input: 32,000 characters (truncated at word boundary)

**Related Components:**
- [article.ts](../../worker/src/article.ts) - Article content extraction
- [summarize.ts](../../worker/src/summarize.ts) - AI summarization
- [topics.ts](../../worker/src/topics.ts) - Topic extraction
- [summary-cache.ts](../../worker/src/summary-cache.ts) - Summary caching

**Values Decision:**
- No Meta/Facebook models (Llama, BART) - see [No Meta Models](../devlog/2025-11-29-no-meta-models.md)
- Mistral chosen for quality and values alignment

---

## 4. Digest Generation

### POST /digest

Complete pipeline: fetch feeds → summarize articles → format output (markdown or HTML).

**Implementation:** [worker/src/index.ts:452-626](../../worker/src/index.ts)

**Request:**
```http
POST /digest HTTP/1.1
Host: rss-agent.mpazbot.workers.dev
Content-Type: application/json

{
  "collection": "ai-ml",
  "since": "7d",
  "limit": 3,
  "format": "markdown",
  "summaryStyle": "brief",
  "title": "Weekly AI Digest"
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `collection` | string | No* | - | Built-in collection name (ai-ml, tech-news, dev-tools) |
| `feeds` | array | No* | - | Custom feed array (if not using collection) |
| `since` | string | No | "24h" | Filter items by date |
| `limit` | number | No | 5 | Max items per feed |
| `format` | string | No | "markdown" | Output format: markdown or html |
| `summaryStyle` | string | No | "brief" | AI summary style |
| `title` | string | No | - | Custom digest title |

*Either `collection` or `feeds` is required

**Response:**
```json
{
  "success": true,
  "digest": "# Weekly AI Digest\n\n*Generated: November 30, 2025*\n\n## Hugging Face Blog\n\n### [Diffusers welcomes FLUX-2](https://huggingface.co/blog/flux-2)\n*November 25, 2025*\n\nFLUX.2 is Black Forest Labs' new image generation model...\n\n---\n*Powered by rss-agent + Workers AI (Mistral)*",
  "format": "markdown",
  "meta": {
    "feedCount": 2,
    "articleCount": 6,
    "summarizedCount": 6,
    "generatedAt": "2025-11-30T12:00:00Z"
  }
}
```

**Built-in Collections:**

| ID | Name | Feeds |
|----|------|-------|
| `ai-ml` | AI & Machine Learning | Hugging Face, OpenAI |
| `tech-news` | Tech News | Ars Technica, The Verge |
| `dev-tools` | Development & Infrastructure | Cloudflare, GitHub |

**Output Formats:**

**Markdown:**
```markdown
# Weekly AI Digest

*Generated: November 30, 2025*

## Hugging Face Blog

### [Article Title](url)
*November 25, 2025*

Article summary here...

---
*Powered by rss-agent + Workers AI (Mistral)*
```

**HTML:**
- Email-ready HTML with inline styles
- Responsive design (max-width: 600px)
- Clean typography using system fonts
- Mobile-optimized

**Use Cases:**
- Email digests (HTML format)
- Documentation updates (Markdown format)
- Slack/Discord webhooks (Markdown format)
- Personal knowledge base (both formats)
- Automated GitHub commits

**Example Workflows:**

```bash
# Email digest
curl -X POST https://rss-agent.mpazbot.workers.dev/digest \
  -d '{"collection": "ai-ml", "since": "7d", "format": "html"}' \
  | mail -s "Weekly AI Digest" user@example.com

# Save to file
curl -X POST https://rss-agent.mpazbot.workers.dev/digest \
  -d '{"collection": "tech-news", "since": "24h"}' \
  > daily-digest.md

# GitHub Action
curl -X POST https://rss-agent.mpazbot.workers.dev/digest \
  -d '{"collection": "dev-tools", "since": "7d"}' \
  > docs/weekly-digest.md && git add docs/ && git commit -m "Weekly digest"
```

**Related Components:**
- [digest.ts](../../worker/src/digest.ts) - Digest formatting and collections
- [summarize.ts](../../worker/src/summarize.ts) - AI summarization
- [fetch.ts](../../worker/src/fetch.ts) - Feed fetching

---

## 5. Rate Limiting

Per-client request throttling to prevent abuse and ensure fair usage.

**Implementation:** [worker/src/ratelimit.ts](../../worker/src/ratelimit.ts)

**Mechanism:**
- Client identification via `X-Client-ID` header or `CF-Connecting-IP`
- Sliding window rate limiting
- KV-based counter storage
- Configurable window and request limits

**Default Limits:**
- Window: 60 seconds
- Max requests: 100 per window

**Response (rate limited):**
```json
{
  "error": "rate_limited",
  "message": "Too many requests",
  "retryAfter": 45
}
```

**Status Code:** `429 Too Many Requests`

**Client ID Priority:**
1. `X-Client-ID` header (for authenticated clients)
2. `CF-Connecting-IP` (Cloudflare header)
3. "anonymous" (local development fallback)

**Related Components:**
- [ratelimit.ts](../../worker/src/ratelimit.ts) - Rate limiting logic

---

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "error": "error_code",
  "message": "Human-readable description",
  "retryAfter": 60
}
```

**Error Codes:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_url` | 400 | Malformed or invalid URL |
| `feed_not_found` | 404 | URL returned 404 |
| `article_not_found` | 404 | Article URL returned 404 |
| `parse_error` | 422 | XML parsing failed |
| `content_extraction_failed` | 422 | Article content extraction failed |
| `rate_limited` | 429 | Too many requests (includes `retryAfter`) |
| `timeout` | 504 | Fetch exceeded timeout |
| `summarization_failed` | 500 | AI summarization failed |
| `topic_extraction_failed` | 500 | Topic extraction failed |

**Implementation:** [worker/src/index.ts:116-134](../../worker/src/index.ts)

---

## Caching Strategy

### Feed Caching

**TTL:** 15 minutes
**Keys:**
- `feed:{sha256(url)}:content` - Parsed feed JSON
- `feed:{sha256(url)}:etag` - ETag for conditional requests
- `feed:{sha256(url)}:modified` - Last-Modified header

**Behavior:**
- First request: Fetch → Parse → Cache → Return
- Subsequent requests (within 15min): Return cached
- Conditional requests: Use ETag/Last-Modified → 304 returns cached
- `forceRefresh`: Bypass cache, re-fetch

### Summary Caching

**TTL:** 24 hours
**Keys:**
- `summary:{sha256(url)}:{style}` - Complete summary data

**Cached Data:**
```json
{
  "summary": "...",
  "title": "...",
  "model": "@cf/mistralai/mistral-small-3.1-24b-instruct",
  "topics": ["topic1", "topic2"]
}
```

**Economics:**
- First request: Pays AI compute cost
- Subsequent requests (24h): Serve from cache (free)
- Shared caching: Team benefits from single AI execution

**Related Components:**
- [cache.ts](../../worker/src/cache.ts) - Feed caching
- [summary-cache.ts](../../worker/src/summary-cache.ts) - Summary caching

---

## Feature Roadmap

### Completed (Phase 1-4)

- [x] RSS 2.0 and Atom parsing
- [x] Cloudflare KV caching
- [x] Rate limiting
- [x] Batch feed fetching
- [x] AI summarization (Mistral)
- [x] Topic extraction
- [x] Digest generation (Markdown/HTML)
- [x] Built-in collections
- [x] Claude Code agent integration

### Planned (Phase 5+)

- [ ] Orchestrator integration (batch scheduling)
- [ ] Semantic search over cached content
- [ ] Trend detection across feeds
- [ ] Personalized filtering
- [ ] MCP server implementation
- [ ] OPML import/export
- [ ] Webhook delivery

---

## Testing

**Test Coverage:** 267 tests

**Categories:**
- Unit tests: 209 (components, utilities, parsing)
- Agent workflow tests: 58 (end-to-end scenarios)

**Test Commands:**
```bash
npm run test              # Run all unit tests
npm run test:watch        # Watch mode
npm run test:e2e          # E2E tests (requires deployed worker)
npm run test:agent        # Agent workflow tests
```

**Test Structure:**
- [worker/test/](../../worker/test/) - Unit and integration tests
- [worker/test/agent/](../../worker/test/agent/) - Agent workflow tests
- [worker/test/e2e/](../../worker/test/e2e/) - End-to-end tests

---

[← Back to MOC](./README.md) | [Architecture →](./architecture.md)
