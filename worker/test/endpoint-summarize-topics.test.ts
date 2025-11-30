import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SELF, env } from "cloudflare:test";

// Type for summarize success response
interface SummarizeResponse {
  success: boolean;
  summary?: string;
  title?: string;
  url?: string;
  topics?: string[];
  error?: string;
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
<head><title>AI and Cloud Computing Article</title></head>
<body>
  <article>
    <h1>AI and Cloud Computing Article</h1>
    <p>This article discusses the intersection of artificial intelligence and cloud computing.
    The rise of machine learning has transformed how we process data at scale.
    Edge computing brings AI capabilities closer to users.</p>
  </article>
</body>
</html>
`;

describe("POST /summarize with topic extraction", () => {
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

  it("returns topics alongside summary", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/topics-test") {
        return Promise.resolve(new Response(MOCK_ARTICLE_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        }));
      }
      return originalFetch(url);
    });

    const response = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/topics-test" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json() as SummarizeResponse;
    expect(data.success).toBe(true);
    expect(data.summary).toBeDefined();
    // Topics should be returned
    expect(data.topics).toBeDefined();
    expect(Array.isArray(data.topics)).toBe(true);
  });

  it("topics are cached along with summary", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/cached-topics-test") {
        return Promise.resolve(new Response(MOCK_ARTICLE_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        }));
      }
      return originalFetch(url);
    });

    // First request - generates topics
    const response1 = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/cached-topics-test" }),
    });

    expect(response1.status).toBe(200);
    const data1 = await response1.json() as SummarizeResponse;
    expect(data1.meta?.cached).toBe(false);
    const originalTopics = data1.topics;

    // Second request - should return cached topics
    const response2 = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/cached-topics-test" }),
    });

    expect(response2.status).toBe(200);
    const data2 = await response2.json() as SummarizeResponse;
    expect(data2.meta?.cached).toBe(true);
    // Topics should be the same as original (from cache)
    expect(data2.topics).toEqual(originalTopics);
  });
});
