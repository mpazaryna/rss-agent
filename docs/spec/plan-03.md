# TDD Implementation Plan: Phase 3 - Claude Code Agent

## Overview

Phase 3 integrates Claude Code agents with the rss-agent worker, enabling natural language interaction with RSS feeds. This phase keeps everything local to this repository as a self-contained proof of concept before moving configuration to systemata/orchestrator in Phase 4.

**Goal:** Natural language feed interaction via Claude Code agent

**Key Deliverables:**
- `feed-fetch.md` agent definition
- `feeds.opml` feed subscription list
- `feed-collections.json` grouped feeds with metadata
- Agent can invoke worker and present results

## Architecture for Phase 3

```
rss-agent/
├── agents/
│   └── feed-fetch.md           # Claude Code agent definition
├── config/
│   ├── feeds.opml              # OPML feed subscriptions
│   └── feed-collections.json   # Grouped feeds with context
├── worker/                     # Existing worker (Phases 1-2)
└── test/
    └── agent/                  # Agent integration tests
```

## Test-First Implementation Sequence

### 1. Feed Configuration Files - Test First

**Write failing tests for:**
- `feeds.opml` is valid OPML 2.0 format
- `feeds.opml` contains at least 2 feed categories
- Each feed has `xmlUrl`, `text`, and `htmlUrl` attributes
- `feed-collections.json` is valid JSON
- Collections have required fields: `id`, `name`, `feeds[]`
- Each feed in collection has `url` and `name`

**Implement to pass:**
- Create `config/feeds.opml` with sample feeds
- Create `config/feed-collections.json` with sample collections

**Refactor:**
- Add TypeScript types for feed collection schema

---

### 2. OPML Parser - Test First

**Write failing tests for:**
- Parse valid OPML and extract feed URLs
- Extract feed metadata (title, htmlUrl, category)
- Handle nested outline elements (categories)
- Return flat list of feeds with category info
- Handle malformed OPML gracefully

**Implement to pass:**
- Create `worker/src/opml.ts` with OPML parser
- Use regex-based parsing (consistent with existing parser approach)

**Refactor:**
- Extract OPML types to `worker/src/types.ts`

---

### 3. Collection Loader - Test First

**Write failing tests for:**
- Load and parse `feed-collections.json`
- Get feeds by collection ID
- Get all feeds across all collections
- Filter collections by tag
- Handle missing collection gracefully

**Implement to pass:**
- Create utilities for loading/querying collections
- These will be used by the agent

**Refactor:**
- Ensure consistent typing with worker types

---

### 4. Agent Definition - Test First

**Write failing tests for:**
- Agent definition file exists at `agents/feed-fetch.md`
- Agent has required sections: Purpose, Tools, Behavior, Examples
- Agent references correct worker endpoints
- Agent includes error handling guidance

**Implement to pass:**
- Create `agents/feed-fetch.md` with full agent definition
- Include example interactions and tool usage

**Refactor:**
- Ensure agent definition follows claude-toolkit patterns

---

### 5. Agent Integration - Test First

**Write failing tests for:**
- Agent can read `feeds.opml` and list feeds
- Agent can read `feed-collections.json` and list collections
- Agent can call `/fetch` endpoint for a single feed
- Agent can call `/batch` endpoint for a collection
- Agent formats results in readable markdown
- Agent handles worker errors gracefully

**Implement to pass:**
- Create test scripts that simulate agent behavior
- Verify end-to-end flow from config → worker → formatted output

**Refactor:**
- Extract common patterns for reuse in Phase 4

---

### 6. Example Workflows - Test First

**Write failing tests for:**
- "List all feeds" returns categorized feed list
- "What's new in [collection]?" fetches and summarizes
- "Check [specific feed]" fetches single feed
- "Get AI news from last 24h" uses `since` parameter
- Error cases return helpful messages

**Implement to pass:**
- Document example workflows in agent definition
- Create test cases that validate each workflow

**Refactor:**
- Polish agent prompts based on test results

---

## Sample Configuration Files

### `config/feeds.opml`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>RSS Agent Feed Subscriptions</title>
    <dateModified>2025-11-29T00:00:00Z</dateModified>
  </head>
  <body>
    <outline text="AI & ML" title="AI & ML">
      <outline type="rss" text="Anthropic News"
               xmlUrl="https://www.anthropic.com/rss.xml"
               htmlUrl="https://www.anthropic.com"/>
      <outline type="rss" text="OpenAI Blog"
               xmlUrl="https://openai.com/blog/rss.xml"
               htmlUrl="https://openai.com/blog"/>
    </outline>
    <outline text="Tech News" title="Tech News">
      <outline type="rss" text="Ars Technica"
               xmlUrl="https://feeds.arstechnica.com/arstechnica/index"
               htmlUrl="https://arstechnica.com"/>
      <outline type="rss" text="The Verge"
               xmlUrl="https://www.theverge.com/rss/index.xml"
               htmlUrl="https://www.theverge.com"/>
    </outline>
    <outline text="Development" title="Development">
      <outline type="rss" text="Cloudflare Blog"
               xmlUrl="https://blog.cloudflare.com/rss/"
               htmlUrl="https://blog.cloudflare.com"/>
      <outline type="rss" text="GitHub Blog"
               xmlUrl="https://github.blog/feed/"
               htmlUrl="https://github.blog"/>
    </outline>
  </body>
</opml>
```

### `config/feed-collections.json`
```json
{
  "collections": [
    {
      "id": "ai-ml",
      "name": "AI & Machine Learning",
      "description": "AI companies and research updates",
      "tags": ["ai", "ml", "llm"],
      "feeds": [
        {
          "url": "https://www.anthropic.com/rss.xml",
          "name": "Anthropic News"
        },
        {
          "url": "https://openai.com/blog/rss.xml",
          "name": "OpenAI Blog"
        }
      ]
    },
    {
      "id": "tech-news",
      "name": "Tech News",
      "description": "General technology news and reviews",
      "tags": ["tech", "news"],
      "feeds": [
        {
          "url": "https://feeds.arstechnica.com/arstechnica/index",
          "name": "Ars Technica"
        },
        {
          "url": "https://www.theverge.com/rss/index.xml",
          "name": "The Verge"
        }
      ]
    },
    {
      "id": "dev-tools",
      "name": "Development & Infrastructure",
      "description": "Developer tools and cloud platforms",
      "tags": ["dev", "cloud", "infrastructure"],
      "feeds": [
        {
          "url": "https://blog.cloudflare.com/rss/",
          "name": "Cloudflare Blog"
        },
        {
          "url": "https://github.blog/feed/",
          "name": "GitHub Blog"
        }
      ]
    }
  ]
}
```

---

## Agent Definition Outline

### `agents/feed-fetch.md`

```markdown
# Feed Fetch Agent

## Purpose
Fetch, filter, and present RSS feed content based on user requests.

## Tools Available
- HTTP fetch to rss-agent worker (dev: https://rss-agent-dev.mpazbot.workers.dev)
- Read access to config/feeds.opml
- Read access to config/feed-collections.json

## Capabilities
- List available feeds and collections
- Fetch single feed by URL or name
- Fetch all feeds in a collection
- Filter by date (since parameter)
- Limit results count

## Behavior
- Always cite sources with links
- Summarize, don't dump raw data
- Group results by feed when showing multiple
- Report failures transparently
- Use markdown formatting for readability

## Example Interactions
[See Step 6 test cases]
```

---

## Completion Criteria

**All tests passing:**
- [x] Configuration file validation tests (10 tests)
- [x] OPML parser tests (7 tests)
- [x] Collection loader tests (10 tests)
- [x] Agent definition validation tests (9 tests)
- [x] Agent integration tests (10 tests)
- [x] Example workflow tests (8 tests)

**TDD cycle followed:**
- [x] Each component had tests written first
- [x] No implementation without failing tests
- [x] Refactoring performed after green tests

**Phase 3 requirements met:**
- [x] `agents/feed-fetch.md` exists and is complete
- [x] `config/feeds.opml` is valid and contains real feeds
- [x] `config/feed-collections.json` is valid with 3+ collections
- [x] Agent can list feeds from OPML
- [x] Agent can fetch feeds via worker
- [x] Agent can fetch collections via /batch
- [x] Agent presents results in readable format

## Test Results

- **Agent Tests:** 54 passing tests
- **Worker Tests:** 148 passing tests
- **E2E Tests:** 11 passing tests
- **Total:** 213 tests

---

## Notes

- Keep all files in this repo for Phase 3 (move to systemata in Phase 4)
- Use the dev worker endpoint for all testing
- Agent definition follows claude-toolkit patterns for future migration
- OPML parser reuses regex approach from RSS/Atom parsers

---

**Document Version:** 1.0
**Created:** November 29, 2025
**Dependencies:** Phases 1-2 complete (worker deployed)
**Estimated Effort:** 2-3 hours
