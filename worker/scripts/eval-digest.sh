#!/bin/bash
# Evaluate AI summarization output for email digest use case

WORKER_URL="${WORKER_URL:-https://rss-agent.mpazbot.workers.dev}"

echo "=== Fetching AI-summarized digest from $WORKER_URL ==="
echo ""

curl -s -X POST "$WORKER_URL/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "feeds": [
      {"url": "https://blog.cloudflare.com/rss/"},
      {"url": "https://feeds.arstechnica.com/arstechnica/index"}
    ],
    "since": "7d",
    "limit": 2,
    "summarize": true,
    "summaryStyle": "brief"
  }' | jq '
    .results[] |
    select(.success) |
    {
      source: .feed.title,
      articles: [.items[] | {
        title: .title,
        url: .url,
        published: .published,
        summary: .summary
      }]
    }
  '
