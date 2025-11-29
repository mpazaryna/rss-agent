import { describe, it, expect } from "vitest";

// E2E tests against deployed worker
// Configure via WORKER_URL environment variable or default to dev
const WORKER_URL =
  (typeof process !== "undefined" && process.env?.WORKER_URL) ||
  "https://rss-agent-dev.mpazbot.workers.dev";

// Real RSS feeds for testing
const TEST_RSS_FEED = "https://feeds.arstechnica.com/arstechnica/index";
const TEST_ATOM_FEED = "https://github.com/anthropics/claude-code/releases.atom";

interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
}

interface FetchSuccessResponse {
  success: true;
  feed: { title: string; url: string };
  items: Array<{ title: string; url: string; published?: string }>;
  meta: { fetchedAt: string; cached: boolean; itemCount: number };
}

interface BatchSuccessResponse {
  success: true;
  results: Array<{
    url: string;
    success: boolean;
    feed?: { title: string };
    items?: Array<{ title: string }>;
    error?: string;
  }>;
  meta: {
    totalFeeds: number;
    successCount: number;
    failureCount: number;
    totalItems: number;
  };
}

interface ErrorResponse {
  error: string;
  message: string;
  retryAfter?: number;
}

describe("E2E: Deployed Worker", () => {
  describe("GET /health", () => {
    it("returns expected health response", async () => {
      const response = await fetch(`${WORKER_URL}/health`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as HealthResponse;
      expect(data.status).toBe("ok");
      expect(data.version).toBe("1.0.0");
      expect(data.timestamp).toBeDefined();
      // Verify timestamp is valid ISO 8601
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });
  });

  describe("POST /fetch - RSS feed", () => {
    it("successfully fetches and parses a real RSS feed", async () => {
      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: TEST_RSS_FEED }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.feed.title).toBeDefined();
      expect(data.items.length).toBeGreaterThan(0);
      expect(data.meta.fetchedAt).toBeDefined();
      expect(data.meta.itemCount).toBeGreaterThan(0);
    });
  });

  describe("POST /fetch - Atom feed", () => {
    it("successfully fetches and parses a real Atom feed", async () => {
      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: TEST_ATOM_FEED }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.feed.title).toBeDefined();
      expect(data.meta.fetchedAt).toBeDefined();
    });
  });

  describe("POST /fetch - filtering", () => {
    it("filters results with limit parameter", async () => {
      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: TEST_RSS_FEED, limit: 3 }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.items.length).toBeLessThanOrEqual(3);
      expect(data.meta.itemCount).toBeLessThanOrEqual(3);
    });

    it("filters results with since parameter", async () => {
      // Use a date far in the past to ensure we get results
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: TEST_RSS_FEED, since }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as FetchSuccessResponse;
      expect(data.success).toBe(true);
    });
  });

  describe("POST /fetch - caching behavior", () => {
    it("returns cached: true on second request", async () => {
      // Use a unique-ish feed to test caching
      const testUrl = TEST_RSS_FEED;

      // First request
      const response1 = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: testUrl }),
      });

      expect(response1.status).toBe(200);
      const data1 = (await response1.json()) as FetchSuccessResponse;
      expect(data1.success).toBe(true);

      // Second request - should be cached
      const response2 = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: testUrl }),
      });

      expect(response2.status).toBe(200);
      const data2 = (await response2.json()) as FetchSuccessResponse;
      expect(data2.success).toBe(true);
      expect(data2.meta.cached).toBe(true);
    });
  });

  describe("POST /batch", () => {
    it("fetches multiple real feeds in parallel", async () => {
      const response = await fetch(`${WORKER_URL}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [{ url: TEST_RSS_FEED }, { url: TEST_ATOM_FEED }],
          limit: 5,
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as BatchSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.meta.totalFeeds).toBe(2);
      expect(data.meta.successCount).toBeGreaterThanOrEqual(1);
      expect(data.results.length).toBe(2);
    });
  });

  describe("Error responses", () => {
    it("returns 400 for missing URL", async () => {
      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("invalid_url");
      expect(data.message).toBeDefined();
    });

    it("returns 400 for invalid URL", async () => {
      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "not-a-valid-url" }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("invalid_url");
    });

    it("returns 422 for non-feed URL", async () => {
      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      });

      expect(response.status).toBe(422);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("parse_error");
    });

    it("returns 405 for wrong method", async () => {
      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "GET",
      });

      expect(response.status).toBe(405);
    });
  });
});
