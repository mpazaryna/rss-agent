import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import type { FeedItem } from "../src/types";

interface BatchFeedResult {
  url: string;
  success: boolean;
  feed?: { title: string; url: string };
  items?: (FeedItem & { summary?: string })[];
  error?: string;
}

interface BatchResponse {
  success: boolean;
  results: BatchFeedResult[];
  meta: {
    totalFeeds: number;
    successCount: number;
    failureCount: number;
    totalItems: number;
    summarizedCount?: number;
  };
}

const MOCK_RSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://test.com</link>
    <description>A test feed</description>
    <item>
      <title>Article One</title>
      <link>https://test.com/article-1</link>
      <pubDate>Sat, 28 Nov 2025 09:00:00 GMT</pubDate>
      <description>First article about technology</description>
    </item>
    <item>
      <title>Article Two</title>
      <link>https://test.com/article-2</link>
      <pubDate>Fri, 27 Nov 2025 09:00:00 GMT</pubDate>
      <description>Second article about AI</description>
    </item>
  </channel>
</rss>`;

const MOCK_ARTICLE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Test Article</title></head>
<body>
  <article>
    <h1>Test Article</h1>
    <p>This is test article content for summarization.</p>
  </article>
</body>
</html>
`;

describe("POST /batch with summarization", () => {
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    // Clear any cached summaries before each test
    const keys = await env.FEED_CACHE.list({ prefix: "summary:" });
    for (const key of keys.keys) {
      await env.FEED_CACHE.delete(key.name);
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("/batch with summarize: true includes summaries in items", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/feed.xml") {
        return Promise.resolve(new Response(MOCK_RSS, { status: 200 }));
      }
      if (url.startsWith("https://test.com/article-")) {
        return Promise.resolve(new Response(MOCK_ARTICLE_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        }));
      }
      return originalFetch(url);
    });

    const response = await SELF.fetch("http://localhost/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feeds: [{ url: "https://example.com/feed.xml" }],
        summarize: true,
        limit: 2,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json() as BatchResponse;
    expect(data.success).toBe(true);
    expect(data.results[0].success).toBe(true);
    expect(data.results[0].items).toBeDefined();
    expect(data.results[0].items!.length).toBeGreaterThan(0);
    // Each item should have a summary
    for (const item of data.results[0].items!) {
      expect(item.summary).toBeDefined();
      expect(typeof item.summary).toBe("string");
    }
  });

  it("batch without summarize: true does not include AI summaries", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/feed.xml") {
        return Promise.resolve(new Response(MOCK_RSS, { status: 200 }));
      }
      return originalFetch(url);
    });

    const response = await SELF.fetch("http://localhost/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feeds: [{ url: "https://example.com/feed.xml" }],
        limit: 2,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json() as BatchResponse;
    expect(data.success).toBe(true);
    // Items should have the feed's description as summary, not AI summary
    // (the feed already has description in RSS which becomes summary)
    for (const item of data.results[0].items!) {
      // These are from the RSS feed's description, not AI summaries
      expect(item.summary).toBeDefined();
    }
    // Meta should not have summarizedCount
    expect(data.meta.summarizedCount).toBeUndefined();
  });

  it("failed summarizations don't fail the whole batch", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/feed.xml") {
        return Promise.resolve(new Response(MOCK_RSS, { status: 200 }));
      }
      // Article fetches will fail
      if (url.startsWith("https://test.com/article-")) {
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      }
      return originalFetch(url);
    });

    const response = await SELF.fetch("http://localhost/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feeds: [{ url: "https://example.com/feed.xml" }],
        summarize: true,
        limit: 2,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json() as BatchResponse;
    // Batch should still succeed
    expect(data.success).toBe(true);
    expect(data.results[0].success).toBe(true);
    // Items are still returned, they just might not have AI summaries
    expect(data.results[0].items).toBeDefined();
  });

  it("meta includes summarizedCount when summarize: true", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/feed.xml") {
        return Promise.resolve(new Response(MOCK_RSS, { status: 200 }));
      }
      if (url.startsWith("https://test.com/article-")) {
        return Promise.resolve(new Response(MOCK_ARTICLE_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        }));
      }
      return originalFetch(url);
    });

    const response = await SELF.fetch("http://localhost/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feeds: [{ url: "https://example.com/feed.xml" }],
        summarize: true,
        limit: 2,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json() as BatchResponse;
    expect(data.meta.summarizedCount).toBeDefined();
    expect(data.meta.summarizedCount).toBeGreaterThanOrEqual(0);
  });

  it("supports summaryStyle parameter for batch", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/feed.xml") {
        return Promise.resolve(new Response(MOCK_RSS, { status: 200 }));
      }
      if (url.startsWith("https://test.com/article-")) {
        return Promise.resolve(new Response(MOCK_ARTICLE_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        }));
      }
      return originalFetch(url);
    });

    const response = await SELF.fetch("http://localhost/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feeds: [{ url: "https://example.com/feed.xml" }],
        summarize: true,
        summaryStyle: "bullets",
        limit: 1,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json() as BatchResponse;
    expect(data.success).toBe(true);
    // We can't easily verify the style was used, but the request should succeed
  });
});
