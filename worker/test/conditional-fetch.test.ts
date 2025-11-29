import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { env } from "cloudflare:test";
import { fetchFeedWithCache } from "../src/fetch";
import { generateCacheKey, cacheFeed, type CachedFeedData } from "../src/cache";

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
    <title>Test Feed Updated</title>
    <link>https://test.com</link>
    <description>An updated feed</description>
    <item>
      <title>New Article</title>
      <link>https://test.com/new-article</link>
      <pubDate>Sun, 29 Nov 2025 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe("Conditional Requests", () => {
  let originalFetch: typeof fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("If-None-Match header", () => {
    it("includes If-None-Match header when ETag is cached", async () => {
      const url = "https://example.com/feed.xml";
      const cachedEtag = '"abc123"';

      // Pre-populate cache with ETag
      const key = await generateCacheKey(url);
      await env.FEED_CACHE.put(`${key}:etag`, cachedEtag);

      // Setup mock to capture request headers
      mockFetch.mockResolvedValueOnce(
        new Response(MOCK_RSS, {
          status: 200,
          headers: { "ETag": '"abc123"' },
        })
      );

      await fetchFeedWithCache(url, env.FEED_CACHE);

      expect(mockFetch).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          headers: expect.objectContaining({
            "If-None-Match": cachedEtag,
          }),
        })
      );
    });

    it("does not include If-None-Match when no ETag cached", async () => {
      const url = "https://fresh.com/feed.xml";

      mockFetch.mockResolvedValueOnce(
        new Response(MOCK_RSS, { status: 200 })
      );

      await fetchFeedWithCache(url, env.FEED_CACHE);

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;
      expect(headers["If-None-Match"]).toBeUndefined();
    });
  });

  describe("If-Modified-Since header", () => {
    it("includes If-Modified-Since header when Last-Modified is cached", async () => {
      const url = "https://example.com/feed.xml";
      const cachedModified = "Sat, 28 Nov 2025 10:00:00 GMT";

      // Pre-populate cache with Last-Modified
      const key = await generateCacheKey(url);
      await env.FEED_CACHE.put(`${key}:modified`, cachedModified);

      mockFetch.mockResolvedValueOnce(
        new Response(MOCK_RSS, {
          status: 200,
          headers: { "Last-Modified": cachedModified },
        })
      );

      await fetchFeedWithCache(url, env.FEED_CACHE);

      expect(mockFetch).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          headers: expect.objectContaining({
            "If-Modified-Since": cachedModified,
          }),
        })
      );
    });

    it("does not include If-Modified-Since when no Last-Modified cached", async () => {
      const url = "https://fresh2.com/feed.xml";

      mockFetch.mockResolvedValueOnce(
        new Response(MOCK_RSS, { status: 200 })
      );

      await fetchFeedWithCache(url, env.FEED_CACHE);

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;
      expect(headers["If-Modified-Since"]).toBeUndefined();
    });
  });

  describe("304 Not Modified response", () => {
    it("returns cached data on 304 response without re-parsing", async () => {
      const url = "https://cached.com/feed.xml";
      const cachedData: CachedFeedData = {
        feed: {
          title: "Cached Feed",
          url: "https://cached.com",
          description: "Already cached",
        },
        items: [
          {
            title: "Cached Article",
            url: "https://cached.com/article",
            categories: [],
          },
        ],
        cachedAt: new Date().toISOString(),
      };

      // Pre-populate cache with content and ETag
      await cacheFeed(env.FEED_CACHE, url, cachedData, {
        etag: '"cached-etag"',
      });

      // Mock returns 304 Not Modified
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 304 })
      );

      const result = await fetchFeedWithCache(url, env.FEED_CACHE);

      expect(result.success).toBe(true);
      expect(result.feed?.title).toBe("Cached Feed");
      expect(result.items).toHaveLength(1);
      expect(result.cached).toBe(true);
    });

    it("returns error when 304 received but no cached content exists", async () => {
      const url = "https://missing-cache.com/feed.xml";

      // Only store ETag, not content
      const key = await generateCacheKey(url);
      await env.FEED_CACHE.put(`${key}:etag`, '"orphan-etag"');

      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 304 })
      );

      const result = await fetchFeedWithCache(url, env.FEED_CACHE);

      expect(result.success).toBe(false);
      expect(result.error).toBe("feed_not_found");
    });
  });

  describe("200 response with new content", () => {
    it("updates cache on 200 response with new content", async () => {
      const url = "https://update.com/feed.xml";
      const oldData: CachedFeedData = {
        feed: {
          title: "Old Feed",
          url: "https://update.com",
        },
        items: [],
        cachedAt: new Date().toISOString(),
      };

      // Pre-populate with old data
      await cacheFeed(env.FEED_CACHE, url, oldData, {
        etag: '"old-etag"',
      });

      // Mock returns new content with new ETag
      mockFetch.mockResolvedValueOnce(
        new Response(UPDATED_RSS, {
          status: 200,
          headers: { "ETag": '"new-etag"' },
        })
      );

      const result = await fetchFeedWithCache(url, env.FEED_CACHE);

      expect(result.success).toBe(true);
      expect(result.feed?.title).toBe("Test Feed Updated");
      expect(result.cached).toBe(false);

      // Verify cache was updated
      const key = await generateCacheKey(url);
      const newEtag = await env.FEED_CACHE.get(`${key}:etag`);
      expect(newEtag).toBe('"new-etag"');
    });

    it("stores new ETag and Last-Modified in cache", async () => {
      const url = "https://headers.com/feed.xml";

      mockFetch.mockResolvedValueOnce(
        new Response(MOCK_RSS, {
          status: 200,
          headers: {
            "ETag": '"fresh-etag"',
            "Last-Modified": "Sun, 29 Nov 2025 12:00:00 GMT",
          },
        })
      );

      await fetchFeedWithCache(url, env.FEED_CACHE);

      const key = await generateCacheKey(url);
      const storedEtag = await env.FEED_CACHE.get(`${key}:etag`);
      const storedModified = await env.FEED_CACHE.get(`${key}:modified`);

      expect(storedEtag).toBe('"fresh-etag"');
      expect(storedModified).toBe("Sun, 29 Nov 2025 12:00:00 GMT");
    });
  });

  describe("both conditional headers", () => {
    it("includes both If-None-Match and If-Modified-Since when both cached", async () => {
      const url = "https://both.com/feed.xml";
      const cachedEtag = '"both-etag"';
      const cachedModified = "Sat, 28 Nov 2025 08:00:00 GMT";

      // Pre-populate cache with both
      const key = await generateCacheKey(url);
      await env.FEED_CACHE.put(`${key}:etag`, cachedEtag);
      await env.FEED_CACHE.put(`${key}:modified`, cachedModified);

      mockFetch.mockResolvedValueOnce(
        new Response(MOCK_RSS, { status: 200 })
      );

      await fetchFeedWithCache(url, env.FEED_CACHE);

      expect(mockFetch).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          headers: expect.objectContaining({
            "If-None-Match": cachedEtag,
            "If-Modified-Since": cachedModified,
          }),
        })
      );
    });
  });
});
