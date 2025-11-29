import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SELF } from "cloudflare:test";
import type { FeedItem } from "../src/types";

interface FetchSuccessResponse {
  success: true;
  feed: { title: string; url: string };
  items: FeedItem[];
  meta: { fetchedAt: string; cached: boolean; itemCount: number };
}

interface FetchErrorResponse {
  error: string;
  message: string;
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
      <description>First article</description>
    </item>
    <item>
      <title>Article Two</title>
      <link>https://test.com/article-2</link>
      <pubDate>Fri, 27 Nov 2025 09:00:00 GMT</pubDate>
      <description>Second article</description>
    </item>
    <item>
      <title>Article Three</title>
      <link>https://test.com/article-3</link>
      <pubDate>Thu, 26 Nov 2025 09:00:00 GMT</pubDate>
      <description>Third article</description>
    </item>
  </channel>
</rss>`;

describe("POST /fetch endpoint", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("successful requests", () => {
    it("returns parsed feed for valid URL", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "https://example.com/feed.xml") {
          return Promise.resolve(new Response(MOCK_RSS, { status: 200 }));
        }
        return originalFetch(url);
      });

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/feed.xml" }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.feed.title).toBe("Test Feed");
      expect(data.items).toHaveLength(3);
    });

    it("includes meta.fetchedAt timestamp", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "https://example.com/feed.xml") {
          return Promise.resolve(new Response(MOCK_RSS, { status: 200 }));
        }
        return originalFetch(url);
      });

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/feed.xml" }),
      });

      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.meta.fetchedAt).toBeDefined();
      // Should be valid ISO date
      const date = new Date(data.meta.fetchedAt);
      expect(date.toISOString()).toBe(data.meta.fetchedAt);
    });

    it("includes meta.cached flag (false for fresh fetch)", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "https://example.com/feed.xml") {
          return Promise.resolve(new Response(MOCK_RSS, { status: 200 }));
        }
        return originalFetch(url);
      });

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/feed.xml" }),
      });

      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.meta.cached).toBe(false);
    });

    it("includes meta.itemCount", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "https://example.com/feed.xml") {
          return Promise.resolve(new Response(MOCK_RSS, { status: 200 }));
        }
        return originalFetch(url);
      });

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/feed.xml" }),
      });

      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.meta.itemCount).toBe(3);
    });
  });

  describe("filtering with since parameter", () => {
    it("filters items by since date", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "https://example.com/feed.xml") {
          return Promise.resolve(new Response(MOCK_RSS, { status: 200 }));
        }
        return originalFetch(url);
      });

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/feed.xml",
          since: "2025-11-27T00:00:00Z",
        }),
      });

      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.success).toBe(true);
      // Should only include articles from Nov 27 and 28
      expect(data.items).toHaveLength(2);
      expect(data.meta.itemCount).toBe(2);
    });
  });

  describe("limiting with limit parameter", () => {
    it("limits items to specified count", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "https://example.com/feed.xml") {
          return Promise.resolve(new Response(MOCK_RSS, { status: 200 }));
        }
        return originalFetch(url);
      });

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/feed.xml",
          limit: 2,
        }),
      });

      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.items).toHaveLength(2);
      expect(data.meta.itemCount).toBe(2);
    });
  });

  describe("error handling", () => {
    it("returns 400 for missing URL", async () => {
      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as FetchErrorResponse;
      expect(data.error).toBe("invalid_url");
    });

    it("returns 400 for invalid URL", async () => {
      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "not-a-valid-url" }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as FetchErrorResponse;
      expect(data.error).toBe("invalid_url");
    });

    it("returns 400 for invalid JSON body", async () => {
      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      expect(response.status).toBe(400);
    });

    it("returns 404 for feed not found", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "https://example.com/missing.xml") {
          return Promise.resolve(new Response("Not Found", { status: 404 }));
        }
        return originalFetch(url);
      });

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/missing.xml" }),
      });

      expect(response.status).toBe(404);
      const data = (await response.json()) as FetchErrorResponse;
      expect(data.error).toBe("feed_not_found");
    });

    it("returns 422 for parse errors", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "https://example.com/bad.xml") {
          return Promise.resolve(new Response("<html>Not a feed</html>", { status: 200 }));
        }
        return originalFetch(url);
      });

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/bad.xml" }),
      });

      expect(response.status).toBe(422);
      const data = (await response.json()) as FetchErrorResponse;
      expect(data.error).toBe("parse_error");
    });

    it("returns 405 for non-POST requests", async () => {
      const response = await SELF.fetch("http://localhost/fetch", {
        method: "GET",
      });

      expect(response.status).toBe(405);
    });
  });
});
