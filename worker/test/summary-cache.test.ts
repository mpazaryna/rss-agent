import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCachedSummary,
  cacheSummary,
  getSummaryCacheKey,
} from "../src/summary-cache";

// Mock KV namespace
function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => store.delete(key)),
    _store: store,
  };
}

describe("Summary Caching", () => {
  describe("getSummaryCacheKey", () => {
    it("generates consistent key for same URL and style", () => {
      const key1 = getSummaryCacheKey("https://example.com/article", "brief");
      const key2 = getSummaryCacheKey("https://example.com/article", "brief");
      expect(key1).toBe(key2);
    });

    it("generates different keys for different URLs", () => {
      const key1 = getSummaryCacheKey("https://example.com/article1", "brief");
      const key2 = getSummaryCacheKey("https://example.com/article2", "brief");
      expect(key1).not.toBe(key2);
    });

    it("generates different keys for different styles", () => {
      const key1 = getSummaryCacheKey("https://example.com/article", "brief");
      const key2 = getSummaryCacheKey("https://example.com/article", "detailed");
      expect(key1).not.toBe(key2);
    });

    it("includes 'summary:' prefix in key", () => {
      const key = getSummaryCacheKey("https://example.com/article", "brief");
      expect(key).toMatch(/^summary:/);
    });
  });

  describe("cacheSummary", () => {
    it("stores summary in KV", async () => {
      const kv = createMockKV();
      const summary = {
        summary: "Test summary content",
        title: "Test Article",
        model: "@cf/mistralai/mistral-small-3.1-24b-instruct",
        topics: ["testing", "caching"],
      };

      await cacheSummary(kv as any, "https://example.com/article", "brief", summary);

      expect(kv.put).toHaveBeenCalled();
      const putCall = kv.put.mock.calls[0];
      expect(putCall[0]).toMatch(/^summary:/);
      expect(JSON.parse(putCall[1])).toMatchObject(summary);
    });

    it("sets TTL to 24 hours", async () => {
      const kv = createMockKV();
      const summary = {
        summary: "Test summary",
        title: "Test",
        model: "test-model",
      };

      await cacheSummary(kv as any, "https://example.com/article", "brief", summary);

      const putCall = kv.put.mock.calls[0];
      expect(putCall[2]).toEqual({ expirationTtl: 86400 }); // 24 hours in seconds
    });
  });

  describe("getCachedSummary", () => {
    it("returns null when no cached summary exists", async () => {
      const kv = createMockKV();

      const result = await getCachedSummary(kv as any, "https://example.com/new", "brief");

      expect(result).toBeNull();
    });

    it("returns cached summary when it exists", async () => {
      const kv = createMockKV();
      const summary = {
        summary: "Cached summary content",
        title: "Cached Article",
        model: "test-model",
      };
      const key = getSummaryCacheKey("https://example.com/article", "brief");
      kv._store.set(key, JSON.stringify(summary));

      const result = await getCachedSummary(kv as any, "https://example.com/article", "brief");

      expect(result).toEqual(summary);
    });

    it("returns null for different style", async () => {
      const kv = createMockKV();
      const summary = {
        summary: "Brief summary",
        title: "Article",
        model: "test-model",
      };
      const key = getSummaryCacheKey("https://example.com/article", "brief");
      kv._store.set(key, JSON.stringify(summary));

      // Request with different style
      const result = await getCachedSummary(kv as any, "https://example.com/article", "detailed");

      expect(result).toBeNull();
    });

    it("returns null for invalid JSON in cache", async () => {
      const kv = createMockKV();
      const key = getSummaryCacheKey("https://example.com/article", "brief");
      kv._store.set(key, "invalid json");

      const result = await getCachedSummary(kv as any, "https://example.com/article", "brief");

      expect(result).toBeNull();
    });
  });
});
