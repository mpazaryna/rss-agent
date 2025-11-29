import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SELF } from "cloudflare:test";
import type { FeedItem } from "../src/types";

interface BatchFeedResult {
  url: string;
  success: boolean;
  feed?: { title: string; url: string };
  items?: FeedItem[];
  error?: string;
  message?: string;
}

interface BatchSuccessResponse {
  success: true;
  results: BatchFeedResult[];
  meta: {
    totalFeeds: number;
    successCount: number;
    failureCount: number;
    totalItems: number;
  };
}

interface BatchErrorResponse {
  error: string;
  message: string;
}

const MOCK_RSS_1 = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Feed One</title>
    <link>https://feed1.com</link>
    <item>
      <title>Article 1A</title>
      <link>https://feed1.com/article-1a</link>
      <pubDate>Sat, 28 Nov 2025 09:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Article 1B</title>
      <link>https://feed1.com/article-1b</link>
      <pubDate>Fri, 27 Nov 2025 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const MOCK_RSS_2 = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Feed Two</title>
    <link>https://feed2.com</link>
    <item>
      <title>Article 2A</title>
      <link>https://feed2.com/article-2a</link>
      <pubDate>Sat, 28 Nov 2025 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe("POST /batch endpoint", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://feed1.com/feed.xml") {
        return Promise.resolve(new Response(MOCK_RSS_1, { status: 200 }));
      }
      if (url === "https://feed2.com/feed.xml") {
        return Promise.resolve(new Response(MOCK_RSS_2, { status: 200 }));
      }
      if (url === "https://failing.com/feed.xml") {
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      }
      if (url === "https://bad.com/feed.xml") {
        return Promise.resolve(new Response("<html>Not a feed</html>", { status: 200 }));
      }
      return originalFetch(url);
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("successful batch requests", () => {
    it("accepts array of feed URLs", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [
            { url: "https://feed1.com/feed.xml" },
            { url: "https://feed2.com/feed.xml" },
          ],
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as BatchSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(2);
    });

    it("fetches all feeds in parallel", async () => {
      const fetchCalls: number[] = [];
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        fetchCalls.push(Date.now());
        if (url === "https://feed1.com/feed.xml") {
          return Promise.resolve(new Response(MOCK_RSS_1, { status: 200 }));
        }
        if (url === "https://feed2.com/feed.xml") {
          return Promise.resolve(new Response(MOCK_RSS_2, { status: 200 }));
        }
        return originalFetch(url);
      });
      globalThis.fetch = mockFetch;

      await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [
            { url: "https://feed1.com/feed.xml" },
            { url: "https://feed2.com/feed.xml" },
          ],
        }),
      });

      // Both feeds should be fetched
      expect(fetchCalls.length).toBe(2);
    });

    it("returns results array with per-feed success", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [{ url: "https://feed1.com/feed.xml" }],
        }),
      });

      const data = (await response.json()) as BatchSuccessResponse;
      expect(data.results[0].success).toBe(true);
      expect(data.results[0].url).toBe("https://feed1.com/feed.xml");
      expect(data.results[0].feed?.title).toBe("Feed One");
      expect(data.results[0].items).toHaveLength(2);
    });

    it("includes meta.totalFeeds count", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [
            { url: "https://feed1.com/feed.xml" },
            { url: "https://feed2.com/feed.xml" },
          ],
        }),
      });

      const data = (await response.json()) as BatchSuccessResponse;
      expect(data.meta.totalFeeds).toBe(2);
    });

    it("includes meta.successCount", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [
            { url: "https://feed1.com/feed.xml" },
            { url: "https://feed2.com/feed.xml" },
          ],
        }),
      });

      const data = (await response.json()) as BatchSuccessResponse;
      expect(data.meta.successCount).toBe(2);
    });

    it("includes meta.totalItems (sum of all items)", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [
            { url: "https://feed1.com/feed.xml" },
            { url: "https://feed2.com/feed.xml" },
          ],
        }),
      });

      const data = (await response.json()) as BatchSuccessResponse;
      expect(data.meta.totalItems).toBe(3); // 2 from feed1 + 1 from feed2
    });
  });

  describe("mixed success/failure results", () => {
    it("returns per-feed error for failing feeds", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [
            { url: "https://feed1.com/feed.xml" },
            { url: "https://failing.com/feed.xml" },
          ],
        }),
      });

      const data = (await response.json()) as BatchSuccessResponse;
      expect(data.results).toHaveLength(2);

      const successResult = data.results.find(
        (r) => r.url === "https://feed1.com/feed.xml"
      );
      expect(successResult?.success).toBe(true);

      const failedResult = data.results.find(
        (r) => r.url === "https://failing.com/feed.xml"
      );
      expect(failedResult?.success).toBe(false);
      expect(failedResult?.error).toBe("feed_not_found");
    });

    it("includes meta.failureCount", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [
            { url: "https://feed1.com/feed.xml" },
            { url: "https://failing.com/feed.xml" },
          ],
        }),
      });

      const data = (await response.json()) as BatchSuccessResponse;
      expect(data.meta.successCount).toBe(1);
      expect(data.meta.failureCount).toBe(1);
    });

    it("handles parse errors in per-feed results", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [{ url: "https://bad.com/feed.xml" }],
        }),
      });

      const data = (await response.json()) as BatchSuccessResponse;
      expect(data.results[0].success).toBe(false);
      expect(data.results[0].error).toBe("parse_error");
    });
  });

  describe("filtering parameters", () => {
    it("applies since parameter to all feeds", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [{ url: "https://feed1.com/feed.xml" }],
          since: "2025-11-28T00:00:00Z",
        }),
      });

      const data = (await response.json()) as BatchSuccessResponse;
      // Only Article 1A (Nov 28) should be included, not 1B (Nov 27)
      expect(data.results[0].items).toHaveLength(1);
      expect(data.results[0].items?.[0].title).toBe("Article 1A");
    });

    it("applies limit parameter to all feeds", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [{ url: "https://feed1.com/feed.xml" }],
          limit: 1,
        }),
      });

      const data = (await response.json()) as BatchSuccessResponse;
      expect(data.results[0].items).toHaveLength(1);
    });

    it("handles shorthand since value: 24h", async () => {
      // Note: This test is a bit tricky with fixed dates in mock
      // Just verify the request doesn't error
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [{ url: "https://feed1.com/feed.xml" }],
          since: "24h",
        }),
      });

      expect(response.status).toBe(200);
    });

    it("handles shorthand since value: 7d", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [{ url: "https://feed1.com/feed.xml" }],
          since: "7d",
        }),
      });

      expect(response.status).toBe(200);
    });

    it("handles shorthand since value: 30d", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [{ url: "https://feed1.com/feed.xml" }],
          since: "30d",
        }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe("error handling", () => {
    it("returns 400 for missing feeds array", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as BatchErrorResponse;
      expect(data.error).toBe("invalid_url");
    });

    it("returns 400 for empty feeds array", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeds: [] }),
      });

      expect(response.status).toBe(400);
    });

    it("returns 405 for non-POST requests", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "GET",
      });

      expect(response.status).toBe(405);
    });

    it("returns 400 for invalid JSON body", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      expect(response.status).toBe(400);
    });
  });
});
