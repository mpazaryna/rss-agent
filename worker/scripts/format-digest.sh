#!/bin/bash
# Format AI-summarized digest as markdown (ready for email)

WORKER_URL="${WORKER_URL:-https://rss-agent.mpazbot.workers.dev}"

echo "# Daily Tech Digest"
echo ""
echo "Generated: $(date '+%B %d, %Y')"
echo ""

curl -s -X POST "$WORKER_URL/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "feeds": [
      {"url": "https://blog.cloudflare.com/rss/"},
      {"url": "https://feeds.arstechnica.com/arstechnica/index"}
    ],
    "since": "7d",
    "limit": 3,
    "summarize": true,
    "summaryStyle": "brief"
  }' | jq -r '
    .results[] |
    select(.success) |
    "## " + .feed.title + "\n\n" +
    ([.items[] |
      "### [" + .title + "](" + .url + ")\n" +
      "*" + (.published | split("T")[0]) + "*\n\n" +
      .summary + "\n"
    ] | join("\n"))
  '

echo ""
echo "---"
echo "*Powered by rss-agent + Workers AI (Mistral)*"
