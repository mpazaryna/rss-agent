# RSS Agent - Technical Specification

**Version:** 1.0
**Created:** November 28, 2025
**Status:** Spike / Proving Ground
**Repository:** github.com/mpazaryna/rss-agent (to be created)

---

## Executive Summary

RSS Agent is a **proving ground** for the agent infrastructure pattern that will power future agent-based projects. By building a low-stakes RSS fetching system first, we validate the architectural patterns before applying them to high-stakes client work.

**What this proves:**
- Cloudflare Worker as MCP endpoint
- Claude Code agent invocation of remote workers
- Orchestrator integration with agent/worker pattern
- Caching and state management strategies
- Multi-context execution patterns

**What this is NOT:**
- A full RSS reader application
- A replacement for Lens Engine
- A production content management system

---

## Why RSS as the Proving Ground

| Factor | RSS Agent | Joe Project |
|--------|-----------|-------------|
| Data sensitivity | Public feeds | Client donor data |
| Failure cost | Miss some articles | Damage client relationship |
| Complexity | Parse XML, return JSON | OAuth, SOQL, multi-tenant |
| Timeline pressure | None | January 1 deadline |
| Integration complexity | HTTP GET | Salesforce OAuth + API |
| Validation goal | Prove the pattern | Deliver production value |

**Core insight:** Build infrastructure with low-stakes work. Apply it to high-stakes work.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE (Your Machine)                                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Orchestrator (github.com/mpazaryna/orchestrator)            ││
│  │ • Skill definitions for feed operations                     ││
│  │ • Batch execution across feed collections                   ││
│  │ • Result persistence                                        ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │ Claude Code Agents (claude-toolkit pattern)                 ││
│  │ • feed-fetch agent                                          ││
│  │ • feed-summarize agent (future)                             ││
│  │ • feed-discover agent (future)                              ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │ Configuration (systemata)                                   ││
│  │ • feeds.opml - subscription list                            ││
│  │ • feed-collections.json - grouped feeds by context          ││
│  └─────────────────────────────────────────────────────────────┘│
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP / MCP
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  CLOUDFLARE EDGE                                                 │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ rss-agent Worker                                            ││
│  │                                                              ││
│  │ Endpoints:                                                   ││
│  │ • POST /fetch    - Fetch and parse a feed URL               ││
│  │ • POST /batch    - Fetch multiple feeds                     ││
│  │ • GET  /health   - Health check                             ││
│  │                                                              ││
│  │ Features:                                                    ││
│  │ • RSS/Atom parsing                                          ││
│  │ • Response caching (KV)                                     ││
│  │ • Rate limiting                                             ││
│  │ • Error handling                                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Cloudflare KV                                               ││
│  │ • Feed response cache (TTL-based)                           ││
│  │ • ETag/Last-Modified tracking                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Workers AI (Future)                                         ││
│  │ • Article summarization                                     ││
│  │ • Topic extraction                                          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Cloudflare Worker: `rss-agent`

**Purpose:** Stateless RSS fetching and parsing service

**Technology:**
- TypeScript
- Cloudflare Workers
- Wrangler for deployment
- Cloudflare KV for caching

#### Endpoints

##### `POST /fetch`

Fetch and parse a single RSS/Atom feed.

**Request:**
```json
{
  "url": "https://example.com/feed.xml",
  "since": "2025-11-01T00:00:00Z",  // optional: only items after this date
  "limit": 10                         // optional: max items to return
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
  "items": [
    {
      "title": "Article Title",
      "url": "https://example.com/article-1",
      "published": "2025-11-28T09:00:00Z",
      "summary": "First paragraph or description...",
      "author": "Author Name",
      "categories": ["tech", "ai"]
    }
  ],
  "meta": {
    "fetchedAt": "2025-11-28T12:00:00Z",
    "cached": false,
    "itemCount": 1
  }
}
```

##### `POST /batch`

Fetch multiple feeds in parallel.

**Request:**
```json
{
  "feeds": [
    { "url": "https://example.com/feed.xml" },
    { "url": "https://another.com/rss" }
  ],
  "since": "24h",  // shorthand: "24h", "7d", "30d", or ISO date
  "limit": 5       // per feed
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    { "url": "https://example.com/feed.xml", "success": true, "items": [...] },
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

##### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2025-11-28T12:00:00Z"
}
```

#### Caching Strategy

```
┌─────────────────────────────────────────────────┐
│ Request: /fetch { url: "..." }                  │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│ Check KV cache for URL hash                     │
│ Key: feed:{sha256(url)}                         │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌───────────────────┐      ┌─────────────────────┐
│ Cache HIT         │      │ Cache MISS          │
│ • Check TTL       │      │ • Fetch feed        │
│ • Return cached   │      │ • Parse XML         │
│   if fresh        │      │ • Store in KV       │
└───────────────────┘      │ • Return fresh      │
                           └─────────────────────┘
```

**Cache TTL:** 15 minutes default (configurable per request)

**Cache key structure:**
```
feed:{hash}:content   → Parsed feed JSON
feed:{hash}:etag      → ETag for conditional requests
feed:{hash}:modified  → Last-Modified header
```

#### Error Handling

| Error | HTTP Status | Response |
|-------|-------------|----------|
| Invalid URL | 400 | `{ "error": "invalid_url", "message": "..." }` |
| Feed not found | 404 | `{ "error": "feed_not_found", "message": "..." }` |
| Parse error | 422 | `{ "error": "parse_error", "message": "..." }` |
| Timeout | 504 | `{ "error": "timeout", "message": "..." }` |
| Rate limited | 429 | `{ "error": "rate_limited", "retryAfter": 60 }` |

---

### 2. Claude Code Agent: `feed-fetch`

**Location:** `claude-toolkit/agents/feed-fetch.md`

**Purpose:** Orchestrate feed fetching through natural language interaction

**Capabilities:**
- Invoke the rss-agent worker
- Process and filter results
- Format output for user consumption
- Handle errors gracefully

**Example interactions:**

```
User: "What's new in the AI feeds today?"

Agent:
1. Reads feeds.opml or feed-collections.json from systemata
2. Identifies "AI" tagged feeds
3. Calls rss-agent worker /batch endpoint
4. Filters/sorts results
5. Presents summary to user
```

```
User: "Check the LangChain blog for updates relevant to my forge project"

Agent:
1. Fetches LangChain feed via worker
2. Reads forge project context from systemata
3. Cross-references articles with project concerns
4. Highlights relevant items
```

**Agent definition structure:**
```markdown
# Feed Fetch Agent

## Purpose
Fetch and filter RSS feeds based on user context and needs.

## Tools Available
- HTTP fetch to rss-agent worker endpoints
- Read access to systemata feed configurations
- Read access to project documentation for context

## Behavior
- Always cite sources with links
- Summarize don't dump
- Filter aggressively based on context
- Report failures transparently

## Invocation
Via orchestrator skill or direct Claude Code interaction
```

---

### 3. Configuration (systemata)

**Location:** `systemata/index/`

#### `feeds.opml`

Standard OPML format for feed subscriptions:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Paz Feed Subscriptions</title>
    <dateModified>2025-11-28T12:00:00Z</dateModified>
  </head>
  <body>
    <outline text="AI & ML" title="AI & ML">
      <outline type="rss" text="LangChain Blog"
               xmlUrl="https://blog.langchain.dev/rss/"
               htmlUrl="https://blog.langchain.dev"/>
      <outline type="rss" text="Anthropic News"
               xmlUrl="https://www.anthropic.com/rss.xml"
               htmlUrl="https://www.anthropic.com"/>
    </outline>
    <outline text="Dev Tools" title="Dev Tools">
      <outline type="rss" text="Cloudflare Blog"
               xmlUrl="https://blog.cloudflare.com/rss/"
               htmlUrl="https://blog.cloudflare.com"/>
    </outline>
  </body>
</opml>
```

#### `feed-collections.json`

Grouped feeds with metadata for agent context:

```json
{
  "collections": [
    {
      "id": "ai-ml",
      "name": "AI & Machine Learning",
      "description": "Feeds related to AI development and ML research",
      "relevantProjects": ["forge", "chiro", "joe-fundraising"],
      "feeds": [
        {
          "url": "https://blog.langchain.dev/rss/",
          "name": "LangChain Blog",
          "tags": ["langchain", "llm", "agents"]
        },
        {
          "url": "https://www.anthropic.com/rss.xml",
          "name": "Anthropic",
          "tags": ["claude", "anthropic", "llm"]
        }
      ]
    },
    {
      "id": "infrastructure",
      "name": "Infrastructure & DevOps",
      "description": "Cloud platforms and deployment",
      "relevantProjects": ["joe-fundraising", "rss-agent"],
      "feeds": [
        {
          "url": "https://blog.cloudflare.com/rss/",
          "name": "Cloudflare Blog",
          "tags": ["cloudflare", "workers", "edge"]
        }
      ]
    }
  ]
}
```

---

## Implementation Phases

### Phase 1: Minimal Worker (Proving the Loop) ✅

**Goal:** Validate Claude Code → Cloudflare Worker → Response

**Deliverables:**
- [x] Basic Cloudflare Worker with `/health` and `/fetch` endpoints
- [x] Single feed parsing (RSS 2.0 only initially)
- [x] Deploy to Cloudflare
- [x] Invoke from Claude Code via curl/fetch

**Success criteria:** Claude Code can request a feed URL and receive parsed JSON

**Estimated effort:** 2-3 hours

---

### Phase 2: Caching & Reliability ✅

**Goal:** Production-ready worker behavior

**Deliverables:**
- [x] KV caching integration
- [x] Atom feed support
- [x] Error handling for all failure modes
- [x] Rate limiting
- [x] `/batch` endpoint

**Success criteria:** Worker handles real-world feeds reliably with caching

**Estimated effort:** 3-4 hours

---

### Phase 3: Claude Code Agent

**Goal:** Natural language feed interaction

**Deliverables:**
- [ ] `feed-fetch.md` agent definition in claude-toolkit
- [ ] `feeds.opml` in systemata
- [ ] `feed-collections.json` in systemata
- [ ] Agent can invoke worker and present results

**Success criteria:** "What's new in AI?" returns relevant feed items

**Estimated effort:** 2-3 hours

---

### Phase 4: Orchestrator Integration

**Goal:** Batch processing via orchestrator

**Deliverables:**
- [ ] Feed fetch skill definition for orchestrator
- [ ] Batch execution across collections
- [ ] Result persistence
- [ ] Scheduled execution pattern

**Success criteria:** Orchestrator can run feed fetches across all collections

**Estimated effort:** 3-4 hours

---

### Phase 5: Intelligence Layer (Future)

**Goal:** AI-enhanced feed processing

**Deliverables:**
- [ ] Workers AI integration for summarization
- [ ] Topic extraction and categorization
- [ ] Relevance scoring against project context
- [ ] `feed-summarize` agent

**Success criteria:** "Summarize this week's AI news relevant to my projects"

**Estimated effort:** 4-6 hours

---

## Pattern Translation to Joe Project

| RSS Agent Component | Joe Project Equivalent |
|--------------------|------------------------|
| `/fetch` endpoint | `query_salesforce` tool |
| `/batch` endpoint | Multi-org query execution |
| KV cache | Org context cache |
| `feeds.opml` | `orgs.json` configuration |
| `feed-fetch` agent | Discovery/Analysis agents |
| Feed collections | Client org groupings |
| Workers AI summarization | Report generation |

**The pattern is identical. The domain is different.**

---

## Repository Structure

```
rss-agent/
├── README.md
├── CLAUDE.md                 # Claude Code context
├── spec.md                   # This document (copy from systemata)
│
├── worker/                   # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts          # Worker entry point
│   │   ├── fetch.ts          # Feed fetching logic
│   │   ├── parse.ts          # RSS/Atom parsing
│   │   ├── cache.ts          # KV caching utilities
│   │   └── types.ts          # TypeScript types
│   ├── wrangler.toml         # Cloudflare config
│   ├── package.json
│   └── tsconfig.json
│
├── agents/                   # Claude Code agent definitions
│   └── feed-fetch.md         # (symlink to claude-toolkit or copy)
│
├── scripts/
│   └── test-worker.sh        # Manual testing scripts
│
└── docs/
    └── devlog/               # Development decisions and notes
```

---

## Success Metrics

### Phase 1 Complete When: ✅
- [x] Worker deployed to `rss-agent-dev.mpazbot.workers.dev`
- [x] `/health` returns 200
- [x] `/fetch` parses a real RSS feed and returns JSON
- [x] Claude Code can invoke it and display results

### Phase 2 Complete When: ✅
- [x] KV caching working (second request returns `cached: true`)
- [x] Atom feeds parse correctly
- [x] All error codes implemented (400, 404, 422, 429, 504)
- [x] Rate limiting active (100 req/60s)
- [x] `/batch` endpoint fetches multiple feeds in parallel

### Spike Complete When:
- All phases 1-4 complete
- Pattern documented and transferable
- Confidence to apply pattern to Joe project

### Current Status
**Phases 1-2 Complete** | 159 tests passing | Dev environment live

---

## Open Questions

1. ~~**Worker subdomain:** What Cloudflare account/subdomain to use?~~ → `mpazbot.workers.dev`
2. **MCP vs HTTP:** Start with raw HTTP, add MCP wrapper later? → Currently HTTP, MCP TBD
3. ~~**Feed parser library:** Use existing npm package or minimal custom?~~ → Custom regex-based parser (Workers runtime compatible)
4. ~~**Auth:** None initially, add API key later if needed?~~ → Rate limiting implemented, API key TBD

---

## References

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare KV](https://developers.cloudflare.com/kv/)
- [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/)
- [RSS 2.0 Specification](https://www.rssboard.org/rss-specification)
- [Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287)
- Joe Project Spec: `systemata/joe-project-v4.md`
- Orchestrator: `github.com/mpazaryna/orchestrator`
- Claude Toolkit: `github.com/mpazaryna/claude-toolkit`

---

**Document Version:** 1.1
**Last Updated:** November 29, 2025
**Author:** Claude Code + Paz
**Next Steps:** Phase 3 - Claude Code Agent integration
