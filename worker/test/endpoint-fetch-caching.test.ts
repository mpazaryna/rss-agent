import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import type { FeedItem } from "../src/types";
import { generateCacheKey, type CachedFeedData } from "../src/cache";

interface FetchSuccessResponse {
  success: true;
  feed: { title: string; url: string };
  items: FeedItem[];
  meta: { fetchedAt: string; cached: boolean; itemCount: number };
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
    </item>
  </channel>
</rss>`;

const UPDATED_RSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Updated Feed</title>
    <link>https://test.com</link>
    <description>An updated feed</description>
    <item>
      <title>New Article</title>
      <link>https://test.com/new-article</link>
      <pubDate>Sun, 29 Nov 2025 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe("POST /fetch endpoint with caching", () => {
  let originalFetch: typeof fetch;
  let mockFetch: ReturnType<typeof vi.fn>;
  let fetchCallCount: number;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchCallCount = 0;
    mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://cached-feed.com/feed.xml") {
        fetchCallCount++;
        return Promise.resolve(
          new Response(MOCK_RSS, {
            status: 200,
            headers: { "ETag": '"test-etag"' },
          })
        );
      }
      return originalFetch(url);
    });
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("first request - fetches and caches", () => {
    it("fetches feed on first request (cache miss)", async () => {
      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://cached-feed.com/feed.xml" }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.meta.cached).toBe(false);
      expect(fetchCallCount).toBe(1);
    });

    it("stores feed in cache after first fetch", async () => {
      await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://cached-feed.com/feed.xml" }),
      });

      // Verify cache was populated
      const key = await generateCacheKey("https://cached-feed.com/feed.xml");
      const cached = await env.FEED_CACHE.get(`${key}:content`);
      expect(cached).not.toBeNull();

      const cachedData = JSON.parse(cached!) as CachedFeedData;
      expect(cachedData.feed.title).toBe("Test Feed");
    });
  });

  describe("second request within TTL - returns cached", () => {
    it("returns cached data on second request (meta.cached: true)", async () => {
      // First request - fetches from origin
      await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://cached-feed.com/feed.xml" }),
      });

      expect(fetchCallCount).toBe(1);

      // Update mock to return 304 for conditional request
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === "https://cached-feed.com/feed.xml") {
          const headers = options?.headers as Record<string, string>;
          if (headers?.["If-None-Match"]) {
            fetchCallCount++;
            return Promise.resolve(new Response(null, { status: 304 }));
          }
          fetchCallCount++;
          return Promise.resolve(
            new Response(MOCK_RSS, {
              status: 200,
              headers: { "ETag": '"test-etag"' },
            })
          );
        }
        return originalFetch(url);
      });

      // Second request - should use cache
      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://cached-feed.com/feed.xml" }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.meta.cached).toBe(true);
      expect(data.feed.title).toBe("Test Feed");
    });

    it("does not re-parse feed on cache hit", async () => {
      // Pre-populate cache
      const cachedData: CachedFeedData = {
        feed: { title: "Pre-cached Feed", url: "https://precached.com" },
        items: [
          { title: "Cached Item", url: "https://precached.com/item", categories: [] },
        ],
        cachedAt: new Date().toISOString(),
      };

      const key = await generateCacheKey("https://precached.com/feed.xml");
      await env.FEED_CACHE.put(`${key}:content`, JSON.stringify(cachedData));
      await env.FEED_CACHE.put(`${key}:etag`, '"precached-etag"');

      // Mock returns 304
      mockFetch.mockImplementation((url: string) => {
        if (url === "https://precached.com/feed.xml") {
          return Promise.resolve(new Response(null, { status: 304 }));
        }
        return originalFetch(url);
      });

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://precached.com/feed.xml" }),
      });

      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.meta.cached).toBe(true);
      expect(data.feed.title).toBe("Pre-cached Feed");
    });
  });

  describe("request with updated content - re-fetches", () => {
    it("re-fetches and updates cache when server returns new content", async () => {
      // Pre-populate with old data
      const oldData: CachedFeedData = {
        feed: { title: "Old Feed", url: "https://update.com" },
        items: [],
        cachedAt: new Date().toISOString(),
      };

      const key = await generateCacheKey("https://update.com/feed.xml");
      await env.FEED_CACHE.put(`${key}:content`, JSON.stringify(oldData));
      await env.FEED_CACHE.put(`${key}:etag`, '"old-etag"');

      // Mock returns new content (200, not 304)
      mockFetch.mockImplementation((url: string) => {
        if (url === "https://update.com/feed.xml") {
          return Promise.resolve(
            new Response(UPDATED_RSS, {
              status: 200,
              headers: { "ETag": '"new-etag"' },
            })
          );
        }
        return originalFetch(url);
      });

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://update.com/feed.xml" }),
      });

      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.meta.cached).toBe(false);
      expect(data.feed.title).toBe("Updated Feed");

      // Verify cache was updated
      const newCached = await env.FEED_CACHE.get(`${key}:content`);
      const newData = JSON.parse(newCached!) as CachedFeedData;
      expect(newData.feed.title).toBe("Updated Feed");

      const newEtag = await env.FEED_CACHE.get(`${key}:etag`);
      expect(newEtag).toBe('"new-etag"');
    });
  });

  describe("force refresh option", () => {
    it("bypasses cache when forceRefresh is true", async () => {
      // Pre-populate cache
      const cachedData: CachedFeedData = {
        feed: { title: "Cached Feed", url: "https://force.com" },
        items: [],
        cachedAt: new Date().toISOString(),
      };

      const key = await generateCacheKey("https://force.com/feed.xml");
      await env.FEED_CACHE.put(`${key}:content`, JSON.stringify(cachedData));
      await env.FEED_CACHE.put(`${key}:etag`, '"cached-etag"');

      let conditionalHeadersSent = false;
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === "https://force.com/feed.xml") {
          const headers = options?.headers as Record<string, string>;
          if (headers?.["If-None-Match"] || headers?.["If-Modified-Since"]) {
            conditionalHeadersSent = true;
          }
          return Promise.resolve(
            new Response(MOCK_RSS, {
              status: 200,
              headers: { "ETag": '"fresh-etag"' },
            })
          );
        }
        return originalFetch(url);
      });

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://force.com/feed.xml",
          forceRefresh: true,
        }),
      });

      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.meta.cached).toBe(false);
      expect(conditionalHeadersSent).toBe(false);
    });
  });
});
