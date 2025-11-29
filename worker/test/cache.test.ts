import { describe, it, expect, vi, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  getCachedFeed,
  cacheFeed,
  generateCacheKey,
  getCacheMetadata,
  DEFAULT_CACHE_TTL,
  type CachedFeedData,
} from "../src/cache";

describe("KV Cache - Read Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateCacheKey", () => {
    it("generates consistent key for same URL", async () => {
      const key1 = await generateCacheKey("https://example.com/feed.xml");
      const key2 = await generateCacheKey("https://example.com/feed.xml");
      expect(key1).toBe(key2);
    });

    it("generates different keys for different URLs", async () => {
      const key1 = await generateCacheKey("https://example.com/feed1.xml");
      const key2 = await generateCacheKey("https://example.com/feed2.xml");
      expect(key1).not.toBe(key2);
    });

    it("uses feed: prefix with sha256 hash", async () => {
      const key = await generateCacheKey("https://example.com/feed.xml");
      expect(key).toMatch(/^feed:[a-f0-9]{64}$/);
    });
  });

  describe("getCachedFeed", () => {
    it("returns null for cache miss", async () => {
      const result = await getCachedFeed(env.FEED_CACHE, "https://nonexistent.com/feed.xml");
      expect(result).toBeNull();
    });

    it("returns cached data for cache hit", async () => {
      const testData: CachedFeedData = {
        feed: {
          title: "Cached Feed",
          url: "https://example.com",
          description: "A cached feed",
        },
        items: [
          {
            title: "Cached Article",
            url: "https://example.com/article",
            categories: [],
          },
        ],
        cachedAt: new Date().toISOString(),
      };

      // Store data in KV
      const key = await generateCacheKey("https://example.com/feed.xml");
      await env.FEED_CACHE.put(`${key}:content`, JSON.stringify(testData));

      const result = await getCachedFeed(env.FEED_CACHE, "https://example.com/feed.xml");
      expect(result).not.toBeNull();
      expect(result?.feed.title).toBe("Cached Feed");
      expect(result?.items).toHaveLength(1);
    });

    it("stores with TTL and retrieves before expiration", async () => {
      const testData: CachedFeedData = {
        feed: {
          title: "TTL Feed",
          url: "https://example.com",
        },
        items: [],
        cachedAt: new Date().toISOString(),
      };

      // Store with minimum TTL (60 seconds) - validates TTL parameter works
      const key = await generateCacheKey("https://ttl.com/feed.xml");
      await env.FEED_CACHE.put(`${key}:content`, JSON.stringify(testData), {
        expirationTtl: 60, // Minimum allowed TTL
      });

      // Retrieve immediately - should still be cached
      const result = await getCachedFeed(env.FEED_CACHE, "https://ttl.com/feed.xml");
      expect(result).not.toBeNull();
      expect(result?.feed.title).toBe("TTL Feed");
    });

    it("uses correct cache key format: feed:{sha256}:content", async () => {
      const url = "https://test.com/feed.xml";
      const key = await generateCacheKey(url);

      const testData: CachedFeedData = {
        feed: { title: "Test", url: "https://test.com" },
        items: [],
        cachedAt: new Date().toISOString(),
      };

      await env.FEED_CACHE.put(`${key}:content`, JSON.stringify(testData));

      // Verify we can retrieve with the same key format
      const stored = await env.FEED_CACHE.get(`${key}:content`);
      expect(stored).not.toBeNull();
    });
  });

  describe("cache metadata", () => {
    it("retrieves stored ETag", async () => {
      const key = await generateCacheKey("https://example.com/feed.xml");
      await env.FEED_CACHE.put(`${key}:etag`, '"abc123"');

      const etag = await env.FEED_CACHE.get(`${key}:etag`);
      expect(etag).toBe('"abc123"');
    });

    it("retrieves stored Last-Modified", async () => {
      const key = await generateCacheKey("https://example.com/feed.xml");
      await env.FEED_CACHE.put(`${key}:modified`, "Sat, 28 Nov 2025 10:00:00 GMT");

      const modified = await env.FEED_CACHE.get(`${key}:modified`);
      expect(modified).toBe("Sat, 28 Nov 2025 10:00:00 GMT");
    });
  });
});

describe("KV Cache - Write Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cacheFeed", () => {
    it("stores feed data in cache", async () => {
      const feedData: CachedFeedData = {
        feed: {
          title: "New Feed",
          url: "https://new.com",
          description: "A new feed",
        },
        items: [
          {
            title: "New Article",
            url: "https://new.com/article",
            categories: ["tech"],
          },
        ],
        cachedAt: new Date().toISOString(),
      };

      await cacheFeed(env.FEED_CACHE, "https://new.com/feed.xml", feedData);

      // Verify it was stored
      const result = await getCachedFeed(env.FEED_CACHE, "https://new.com/feed.xml");
      expect(result).not.toBeNull();
      expect(result?.feed.title).toBe("New Feed");
      expect(result?.items).toHaveLength(1);
    });

    it("stores feed with default TTL (15 minutes)", async () => {
      expect(DEFAULT_CACHE_TTL).toBe(900); // 15 minutes in seconds

      const feedData: CachedFeedData = {
        feed: { title: "TTL Test", url: "https://ttl-test.com" },
        items: [],
        cachedAt: new Date().toISOString(),
      };

      // This should not throw - validates TTL is valid (>= 60 seconds)
      await cacheFeed(env.FEED_CACHE, "https://ttl-test.com/feed.xml", feedData);

      const result = await getCachedFeed(env.FEED_CACHE, "https://ttl-test.com/feed.xml");
      expect(result).not.toBeNull();
    });

    it("stores ETag in separate key", async () => {
      const feedData: CachedFeedData = {
        feed: { title: "ETag Test", url: "https://etag.com" },
        items: [],
        cachedAt: new Date().toISOString(),
      };

      await cacheFeed(env.FEED_CACHE, "https://etag.com/feed.xml", feedData, {
        etag: '"xyz789"',
      });

      const key = await generateCacheKey("https://etag.com/feed.xml");
      const storedEtag = await env.FEED_CACHE.get(`${key}:etag`);
      expect(storedEtag).toBe('"xyz789"');
    });

    it("stores Last-Modified in separate key", async () => {
      const feedData: CachedFeedData = {
        feed: { title: "Modified Test", url: "https://modified.com" },
        items: [],
        cachedAt: new Date().toISOString(),
      };

      await cacheFeed(env.FEED_CACHE, "https://modified.com/feed.xml", feedData, {
        lastModified: "Sun, 29 Nov 2025 12:00:00 GMT",
      });

      const key = await generateCacheKey("https://modified.com/feed.xml");
      const storedModified = await env.FEED_CACHE.get(`${key}:modified`);
      expect(storedModified).toBe("Sun, 29 Nov 2025 12:00:00 GMT");
    });

    it("stores both ETag and Last-Modified when provided", async () => {
      const feedData: CachedFeedData = {
        feed: { title: "Both Test", url: "https://both.com" },
        items: [],
        cachedAt: new Date().toISOString(),
      };

      await cacheFeed(env.FEED_CACHE, "https://both.com/feed.xml", feedData, {
        etag: '"both123"',
        lastModified: "Mon, 30 Nov 2025 08:00:00 GMT",
      });

      const key = await generateCacheKey("https://both.com/feed.xml");
      expect(await env.FEED_CACHE.get(`${key}:etag`)).toBe('"both123"');
      expect(await env.FEED_CACHE.get(`${key}:modified`)).toBe("Mon, 30 Nov 2025 08:00:00 GMT");
    });
  });

  describe("getCacheMetadata", () => {
    it("returns null when no metadata exists", async () => {
      const metadata = await getCacheMetadata(env.FEED_CACHE, "https://nometa.com/feed.xml");
      expect(metadata.etag).toBeNull();
      expect(metadata.lastModified).toBeNull();
    });

    it("returns stored ETag and Last-Modified", async () => {
      const key = await generateCacheKey("https://withmeta.com/feed.xml");
      await env.FEED_CACHE.put(`${key}:etag`, '"meta456"');
      await env.FEED_CACHE.put(`${key}:modified`, "Tue, 01 Dec 2025 00:00:00 GMT");

      const metadata = await getCacheMetadata(env.FEED_CACHE, "https://withmeta.com/feed.xml");
      expect(metadata.etag).toBe('"meta456"');
      expect(metadata.lastModified).toBe("Tue, 01 Dec 2025 00:00:00 GMT");
    });

    it("returns partial metadata when only ETag exists", async () => {
      const key = await generateCacheKey("https://onlyetag.com/feed.xml");
      await env.FEED_CACHE.put(`${key}:etag`, '"onlyetag"');

      const metadata = await getCacheMetadata(env.FEED_CACHE, "https://onlyetag.com/feed.xml");
      expect(metadata.etag).toBe('"onlyetag"');
      expect(metadata.lastModified).toBeNull();
    });
  });
});
