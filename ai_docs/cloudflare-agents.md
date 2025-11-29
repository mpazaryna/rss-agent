# Cloudflare Agents Documentation

## Overview

The Agents SDK enables development of AI-powered agents capable of autonomous task execution, real-time client communication, model invocation, state persistence, task scheduling, asynchronous workflows, web browsing, database querying, and human-in-the-loop support.

## Getting Started

### Quick Start Commands

```sh
npm create cloudflare@latest agents-starter -- --template=cloudflare/agents-starter
npx wrangler@latest deploy
```

For existing Workers projects:
```sh
npm i agents
```

### Basic Agent Implementation

**JavaScript/TypeScript:**
```js
import { Agent, AgentNamespace } from "agents";

export class MyAgent extends Agent {
  // Define methods on the Agent
  // Built-in state via this.setState and this.sql
  // Built-in scheduling via this.schedule
  // WebSocket, HTTP support; run duration: seconds to hours
}
```

### Configuration Setup

**wrangler.jsonc:**
```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "durable_objects": {
    "bindings": [{"name": "MyAgent", "class_name": "MyAgent"}]
  },
  "migrations": [{"tag": "v1", "new_sqlite_classes": ["MyAgent"]}]
}
```

**wrangler.toml:**
```toml
[[durable_objects.bindings]]
name = "MyAgent"
class_name = "MyAgent"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["MyAgent"]
```

## Key Features

### Batteries Included
Built-in state management with automatic state synchronization between agents and clients, event triggering on state changes, and SQL database access.

### Communicative
WebSocket connectivity enables real-time streaming updates, handling of long-running reasoning model responses, asynchronous workflow results, and chat applications via the `useAgent` hook.

### Extensible
Agents function as code, supporting custom AI models, third-party browser services, external database integration, and custom methods.

## Deployment & Performance

Agents deploy to Cloudflare infrastructure using Durable Objects—described as stateful micro-servers scaling to tens of millions—enabling flexible deployment near users for low-latency interaction or near data for throughput optimization.

## Related Cloudflare Services

- **Workers**: Serverless application deployment
- **AI Gateway**: Observability and control features including caching and rate limiting
- **Vectorize**: Vector database for semantic search and recommendations
- **Workers AI**: Serverless GPU-powered model execution
- **Workflows**: Stateful agents with persistent, multi-day execution support
