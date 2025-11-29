# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RSS Agent is a **proving ground** for agent infrastructure patterns. It validates architectural patterns using a low-stakes RSS fetching system before applying them to production projects. The core pattern: Cloudflare Worker as MCP endpoint invoked by Claude Code agents.

## Architecture

```
Claude Code (local)
├── Orchestrator (batch execution, skill definitions)
├── Claude Code Agents (feed-fetch, feed-summarize)
└── Configuration (feeds.opml, feed-collections.json)
         │
         │ HTTP / MCP
         ▼
Cloudflare Edge
├── rss-agent Worker (TypeScript)
│   ├── POST /fetch  - Single feed
│   ├── POST /batch  - Multiple feeds
│   └── GET /health  - Health check
└── Cloudflare KV (response caching)
```

## Planned Structure

```
rss-agent/
├── worker/                   # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts          # Worker entry point, request routing
│   │   ├── fetch.ts          # Feed fetching with timeout/abort
│   │   ├── parse.ts          # RSS 2.0 and Atom parsing
│   │   ├── cache.ts          # KV caching utilities
│   │   ├── validate.ts       # URL validation
│   │   ├── ratelimit.ts      # Rate limiting logic
│   │   ├── errors.ts         # Error response factory
│   │   └── types.ts          # TypeScript types
│   ├── wrangler.toml
│   ├── package.json
│   └── tsconfig.json
├── agents/                   # Claude Code agent definitions
│   └── feed-fetch.md
├── scripts/
│   └── test-worker.sh
└── docs/
    └── devlog/               # Development decisions and notes
```

## Build & Development Commands

Once the worker is implemented:

```bash
# Install dependencies
cd worker && npm install

# Local development
npm run dev           # or: wrangler dev

# Deploy to Cloudflare
npm run deploy        # or: wrangler deploy

# Type checking
npm run typecheck     # or: npx tsc --noEmit

# Testing (Vitest)
npm run test          # Run tests
npm run test:watch    # Watch mode
```

## Key Technical Decisions

- **TypeScript** for the Cloudflare Worker
- **Cloudflare KV** for caching with 15-minute default TTL
- **No auth initially** - may add API key later
- **RSS 2.0 first**, then Atom support
- Cache key structure: `feed:{sha256(url)}:content`, `feed:{hash}:etag`, `feed:{hash}:modified`

## API Endpoints

### `GET /health`

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2025-11-28T12:00:00Z"
}
```

### `POST /fetch`

**Request:**
```json
{
  "url": "https://example.com/feed.xml",
  "since": "2025-11-01T00:00:00Z",
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "feed": {
    "title": "Example Blog",
    "url": "https://example.com",
    "description": "An example blog",
    "lastUpdated": "2025-11-28T10:00:00Z"
  },
  "items": [{
    "title": "Article Title",
    "url": "https://example.com/article-1",
    "published": "2025-11-28T09:00:00Z",
    "summary": "First paragraph or description...",
    "author": "Author Name",
    "categories": ["tech", "ai"]
  }],
  "meta": { "fetchedAt": "...", "cached": false, "itemCount": 1 }
}
```

### `POST /batch`

**Request:**
```json
{
  "feeds": [
    { "url": "https://example.com/feed.xml" },
    { "url": "https://another.com/rss" }
  ],
  "since": "24h",
  "limit": 5
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    { "url": "https://example.com/feed.xml", "success": true, "items": [] },
    { "url": "https://another.com/rss", "success": false, "error": "timeout" }
  ],
  "meta": {
    "totalFeeds": 2,
    "successCount": 1,
    "failureCount": 1,
    "totalItems": 5
  }
}
```

### Error Responses

| Code | Error | Description |
|------|-------|-------------|
| 400 | `invalid_url` | Malformed or invalid URL |
| 404 | `feed_not_found` | URL returned 404 |
| 422 | `parse_error` | XML parsing failed |
| 429 | `rate_limited` | Too many requests (includes `retryAfter`) |
| 504 | `timeout` | Fetch exceeded timeout |

```json
{
  "error": "rate_limited",
  "message": "Too many requests",
  "retryAfter": 60
}
```

## Related Repositories

- `github.com/mpazaryna/orchestrator` - Skill definitions and batch execution
- `github.com/mpazaryna/claude-toolkit` - Agent definitions
- `github.com/mpazaryna/systemata` - Configuration files (feeds.opml, feed-collections.json)

## Caching Strategy

- **Default TTL:** 15 minutes
- **Conditional requests:** Uses `If-None-Match` (ETag) and `If-Modified-Since` headers
- **304 handling:** Returns cached content on 304 response without re-parsing
- **Cache keys:**
  - `feed:{sha256(url)}:content` - Parsed feed JSON
  - `feed:{sha256(url)}:etag` - ETag for conditional requests
  - `feed:{sha256(url)}:modified` - Last-Modified header

## Documentation References

- https://developers.cloudflare.com/workers/ - Cloudflare Workers platform
- https://developers.cloudflare.com/kv/ - Cloudflare KV storage
- https://developers.cloudflare.com/agents - Cloudflare Agents SDK
- https://developers.cloudflare.com/workers-ai/ - Workers AI (inference)
- https://developers.cloudflare.com/ai-gateway/ - AI Gateway (routing, caching, rate limiting)
