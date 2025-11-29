# Cloudflare AI Gateway Documentation

## Overview

**Title:** Cloudflare's AI Gateway allows you to "gain visibility and control over your AI apps."

The platform enables developers to connect applications and gather usage insights through analytics and logging, then implement scaling controls via caching, rate limiting, request retries, and model fallback functionality. Integration requires minimal code modification.

## Core Features

### Analytics
Provides visibility into application metrics including request volume, token consumption, and operational costs for AI applications.

### Logging
Delivers detailed insights regarding individual requests and error occurrences within your system.

### Caching
Serves responses directly from Cloudflare's infrastructure instead of querying the original provider, reducing latency and expenses.

### Rate Limiting
Enables developers to "control how your application scales by limiting the number of requests your application receives."

### Request Retry and Model Fallback
Enhances reliability through automatic retry mechanisms and alternative model selection when failures occur.

### Provider Support
Compatible with Workers AI, OpenAI, Azure OpenAI, HuggingFace, Replicate, and additional AI platforms.

## Key Information

- **Availability:** All Cloudflare plans
- **Setup Complexity:** Single line of code required
- **Last Updated:** August 19, 2025

## Related Products & Resources

The documentation references Workers AI for serverless GPU-powered model execution and Vectorize for vector database capabilities supporting semantic search and LLM context enhancement.
