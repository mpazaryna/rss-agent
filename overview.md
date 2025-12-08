# RSS Agent - Project Overview

## What is RSS Agent?

RSS Agent is an experimental project that serves as a **proving ground for AI agent infrastructure patterns**. It's designed to validate and test architectural approaches for building agent-based systems before applying them to production environments.

The project implements a practical RSS feed fetching and processing system, but its true purpose is to explore how AI agents can interact with cloud services, handle batch operations, and maintain state across distributed systems.

## Why This Project Exists

Before deploying agent infrastructure patterns in high-stakes production environments, we need to:

1. **Test architectural patterns** in a low-risk setting
2. **Validate the agent-to-cloud-service interaction model**
3. **Establish best practices** for agent orchestration and configuration
4. **Build reusable patterns** that can be applied to future projects

RSS feeds provide an ideal testing ground because they're:
- Simple enough to understand quickly
- Complex enough to test real-world patterns
- Non-critical, so failures don't impact production systems
- Well-documented with established standards (RSS 2.0, Atom)

## Core Architecture

The system follows a distributed architecture pattern:

```
Local Environment (Claude Code)
    |
    | Makes HTTP requests
    |
    v
Cloudflare Edge (Worker)
    |
    | Stores cached responses
    |
    v
Cloudflare KV Storage
```

**Key Components:**

- **Claude Code Agents**: Local AI agents that orchestrate feed fetching operations
- **Cloudflare Worker**: Edge service that fetches, parses, and caches RSS feeds
- **Cloudflare KV**: Distributed key-value store for caching feed data

## What It Does

RSS Agent provides three main capabilities:

1. **Single Feed Fetching**: Retrieve and parse individual RSS/Atom feeds
2. **Batch Processing**: Fetch multiple feeds in parallel with a single request
3. **Intelligent Caching**: Store feed data at the edge with conditional updates

The system handles:
- RSS 2.0 and Atom feed formats
- Conditional HTTP requests (ETag, Last-Modified)
- Rate limiting and error handling
- Response caching with configurable TTL

## Key Technical Decisions

**Technology Stack:**
- TypeScript for type-safe edge computing
- Cloudflare Workers for global edge deployment
- Cloudflare KV for distributed caching
- Claude Code for agent orchestration

**Design Principles:**
- Start simple, add complexity only when needed
- No authentication initially (API keys may come later)
- 15-minute default cache TTL
- Graceful degradation on errors

## Project Structure

```
rss-agent/
├── worker/          # Cloudflare Worker (TypeScript)
├── agents/          # AI agent definitions
├── config/          # Feed configurations (OPML, JSON)
├── docs/            # Documentation and development logs
└── scripts/         # Helper scripts for testing
```

## Getting Started

**For Development:**
```bash
cd worker
npm install
npm run dev      # Start local development server
```

**For Deployment:**
```bash
npm run deploy   # Deploy to Cloudflare
```

**Using the API:**
```bash
# Fetch a single feed
curl -X POST https://your-worker.workers.dev/fetch \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/feed.xml"}'
```

## Related Projects

This project is part of a larger ecosystem:

- **orchestrator**: Skill definitions and batch execution patterns
- **claude-toolkit**: Reusable agent definitions
- **systemata**: Configuration management (feeds.opml, collections)

## Learning Outcomes

By working on RSS Agent, we're establishing patterns for:

1. **Agent-to-Service Communication**: How local AI agents interact with cloud services
2. **Batch Processing**: Handling multiple operations efficiently
3. **Caching Strategies**: Optimizing for edge performance
4. **Error Handling**: Graceful degradation in distributed systems
5. **Configuration Management**: Managing feeds and collections across repositories

## Status

This is an active experimental project. The Cloudflare Worker is in development, with the core architecture and API design established. The project serves as a reference implementation for future agent-based systems.

## Documentation

- `README.md` - Project introduction
- `CLAUDE.md` - Detailed technical specifications for AI code assistants
- `docs/` - Development logs and architectural decisions
- `worker/` - Implementation documentation and API details

## License

See LICENSE file in the project root.
