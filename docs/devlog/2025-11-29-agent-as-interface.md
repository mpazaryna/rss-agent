# The Agent as Interface: Implications of RSS Agent Phase 3

**Date:** November 29, 2025

---

## What We Built

A Claude Code agent that fetches RSS feeds through natural language. You say "What's new in AI?" and it reads config files, calls a Cloudflare Worker, and presents formatted results.

That's the *what*. This devlog is about the *so what*.

---

## The Shift: From CLI to Conversation

Traditional tools have rigid interfaces. Want to fetch an RSS feed? Learn the flags:

```bash
curl -X POST https://api.example.com/fetch \
  -H "Content-Type: application/json" \
  -d '{"url": "...", "since": "24h", "limit": 5}'
```

With an agent interface, the same operation becomes:

```
What's new in AI from the last day?
```

The agent handles the translation: it knows which config file has the AI feeds, how to format the API request, and how to present the results. The user's intent maps directly to action without learning syntax.

This isn't just convenience—it's a fundamental change in how we think about tool design.

---

## Implications for Tool Architecture

### 1. The API Becomes Infrastructure, Not Interface

The Cloudflare Worker we built has a clean REST API. But users never see it. The API exists to be called by agents, not humans.

This changes what matters in API design:
- **Structured responses over human-readable ones.** JSON that's easy to parse beats pretty formatting.
- **Granular endpoints over kitchen-sink ones.** Let the agent compose operations.
- **Predictable errors over helpful messages.** Agents need machine-parseable failure modes.

The worker's error responses return `{"error": "parse_error", "message": "..."}` rather than friendly prose. That's intentional—the agent adds the friendliness.

### 2. Configuration as Context

The agent reads `feeds.opml` and `feed-collections.json` to understand what feeds exist. These files serve dual purposes:

1. **Machine configuration** — structured data the agent can query
2. **Shared context** — the agent and user have the same understanding of "the AI collection"

When the user says "check the dev tools feeds," the agent doesn't guess—it looks up the `dev-tools` collection and knows exactly which URLs to fetch.

This pattern—configuration files as shared context—may be more important than the API itself. The config creates a vocabulary the user and agent both understand.

### 3. The Agent as Adapter Layer

The agent definition (`feed-fetch.md`) is essentially an adapter specification:

- **Input:** Natural language requests about feeds
- **Tools:** HTTP endpoints, local files
- **Output:** Formatted markdown responses

This adapter pattern means we can swap implementations without changing the user experience. The worker could move from Cloudflare to AWS Lambda. The config files could move to a database. As long as the agent definition stays consistent, users notice nothing.

---

## What This Means for Development Workflow

### Agents Change What We Build

Traditional development: build a CLI, write docs, hope users read them.

Agent-first development: build an API, write an agent definition, let the agent be the docs.

The agent definition *is* the documentation. It specifies:
- What the tool can do (capabilities)
- How to invoke it (tool descriptions)
- What good output looks like (examples)
- How to handle failures (error guidance)

Users don't read docs—they ask questions. The agent answers.

### Testing Shifts Upstream

We wrote 54 tests for the agent integration. Many test things like "can the agent read the config and call the API?" These are integration tests that validate the *workflow*, not just the code.

Traditional testing: does the function return the right value?
Agent testing: does the full interaction produce the right outcome?

The tests in `workflows.test.ts` read like user stories:
- "List all feeds" returns categorized results
- "What's new in [collection]?" fetches and summarizes
- Error cases return helpful messages

We're testing user intent, not implementation details.

### The Disappearing Interface

Here's the most profound implication: **the interface disappears**.

No CLI to learn. No web UI to navigate. No API docs to reference. You just... ask.

The cognitive load shifts entirely to the agent. Users bring intent; the agent handles execution.

---

## Risks and Limitations

### 1. Opacity

When the agent fails, debugging is harder. Did the API return bad data? Did the agent misinterpret the request? Did the config have wrong URLs?

We hit this with the Anthropic feed—it was returning 404, but the error surfaced as "feed not found" without clarity on *why*. Traditional tools would show the HTTP response directly.

### 2. Context Window as Constraint

Agents have limited context. Our feed-fetch agent works because the configs are small and responses are bounded by `limit` parameters. Scaling to hundreds of feeds or full-text content would hit context limits.

The agent pattern works best for *coordination*, not *bulk processing*.

### 3. Non-Determinism

Ask the same question twice, get slightly different responses. The agent might format results differently, choose different words, or take a different path through the tools.

For many use cases this is fine—even beneficial. For others (automated pipelines, compliance logging), it's a problem.

---

## The Bigger Picture

RSS Agent is a proving ground. The pattern we validated:

```
User Intent → Agent → API → Structured Data → Formatted Response
```

This pattern applies far beyond RSS feeds:

- **Database queries:** "Show me users who signed up last week"
- **Infrastructure management:** "Scale the API servers to handle the traffic spike"
- **Code operations:** "Find all the places we handle authentication errors"

The agent becomes a universal adapter between human intent and machine capability.

---

## What Comes Next

Phase 4 moves configuration to a central orchestrator. But the real question isn't about config management—it's about composition.

What happens when agents call other agents? When the feed-fetch agent needs to summarize content, does it call a summarization agent? When it needs to filter by topic, does it call a classification agent?

We built a single-purpose agent. The next frontier is agent orchestration—agents as building blocks for larger workflows.

---

## Conclusion

The RSS Agent isn't interesting because it fetches feeds. It's interesting because it demonstrates a new relationship between users and tools.

The interface isn't a screen or a command line. It's a conversation.

That changes everything about how we design, build, and think about software.

---

*This devlog is part of the RSS Agent project, a proving ground for agent infrastructure patterns.*
