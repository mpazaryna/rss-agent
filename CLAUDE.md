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
│   │   ├── index.ts          # Worker entry point
│   │   ├── fetch.ts          # Feed fetching logic
│   │   ├── parse.ts          # RSS/Atom parsing
│   │   ├── cache.ts          # KV caching utilities
│   │   └── types.ts          # TypeScript types
│   ├── wrangler.toml
│   ├── package.json
│   └── tsconfig.json
├── agents/                   # Claude Code agent definitions
│   └── feed-fetch.md
└── scripts/
    └── test-worker.sh
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
```

## Key Technical Decisions

- **TypeScript** for the Cloudflare Worker
- **Cloudflare KV** for caching with 15-minute default TTL
- **No auth initially** - may add API key later
- **RSS 2.0 first**, then Atom support
- Cache key structure: `feed:{sha256(url)}:content`, `feed:{hash}:etag`, `feed:{hash}:modified`

## API Response Format

Successful `/fetch` response:
```json
{
  "success": true,
  "feed": { "title": "...", "url": "...", "lastUpdated": "..." },
  "items": [{ "title": "...", "url": "...", "published": "...", "summary": "..." }],
  "meta": { "fetchedAt": "...", "cached": false, "itemCount": 1 }
}
```

Error codes: 400 (invalid_url), 404 (feed_not_found), 422 (parse_error), 429 (rate_limited), 504 (timeout)

## Related Repositories

- `github.com/mpazaryna/orchestrator` - Skill definitions and batch execution
- `github.com/mpazaryna/claude-toolkit` - Agent definitions
- `github.com/mpazaryna/systemata` - Configuration files (feeds.opml, feed-collections.json)

## Documentation References

- https://developers.cloudflare.com/workers/ - Cloudflare Workers platform
- https://developers.cloudflare.com/agents - Cloudflare Agents SDK
- https://developers.cloudflare.com/workers-ai/ - Workers AI (inference)
- https://developers.cloudflare.com/ai-gateway/ - AI Gateway (routing, caching, rate limiting)
