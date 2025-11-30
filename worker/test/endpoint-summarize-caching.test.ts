import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SELF, env } from "cloudflare:test";

// Type for summarize success response
interface SummarizeResponse {
  success: boolean;
  summary?: string;
  title?: string;
  url?: string;
  error?: string;
  message?: string;
  meta?: {
    model: string;
    style: string;
    summarizedAt: string;
    cached: boolean;
  };
}

// Mock HTML for article fetching
const MOCK_ARTICLE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Test Article Title</title></head>
<body>
  <article>
    <h1>Test Article Title</h1>
    <p>This is the main content of the test article. It contains important information.</p>
  </article>
</body>
</html>
`;

describe("POST /summarize caching", () => {
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

  it("caches summary after first request", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/cache-test") {
        return Promise.resolve(new Response(MOCK_ARTICLE_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        }));
      }
      return originalFetch(url);
    });

    // First request
    const response1 = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/cache-test" }),
    });

    expect(response1.status).toBe(200);
    const data1 = await response1.json() as SummarizeResponse;
    expect(data1.success).toBe(true);
    expect(data1.meta?.cached).toBe(false);

    // Second request should be cached
    const response2 = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/cache-test" }),
    });

    expect(response2.status).toBe(200);
    const data2 = await response2.json() as SummarizeResponse;
    expect(data2.success).toBe(true);
    expect(data2.meta?.cached).toBe(true);
    expect(data2.summary).toBe(data1.summary);
  });

  it("different styles have separate cache entries", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/style-cache-test") {
        return Promise.resolve(new Response(MOCK_ARTICLE_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        }));
      }
      return originalFetch(url);
    });

    // First request with brief style
    const response1 = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/style-cache-test", style: "brief" }),
    });

    expect(response1.status).toBe(200);
    const data1 = await response1.json() as SummarizeResponse;
    expect(data1.meta?.cached).toBe(false);

    // Request with detailed style should NOT be cached
    const response2 = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/style-cache-test", style: "detailed" }),
    });

    expect(response2.status).toBe(200);
    const data2 = await response2.json() as SummarizeResponse;
    expect(data2.meta?.cached).toBe(false);
  });

  it("forceRefresh bypasses cache", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/force-refresh-test") {
        return Promise.resolve(new Response(MOCK_ARTICLE_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        }));
      }
      return originalFetch(url);
    });

    // First request to populate cache
    const response1 = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/force-refresh-test" }),
    });

    expect(response1.status).toBe(200);
    const data1 = await response1.json() as SummarizeResponse;
    expect(data1.meta?.cached).toBe(false);

    // Second request with forceRefresh should bypass cache
    const response2 = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/force-refresh-test", forceRefresh: true }),
    });

    expect(response2.status).toBe(200);
    const data2 = await response2.json() as SummarizeResponse;
    expect(data2.meta?.cached).toBe(false);
  });
});
