import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchFeed } from "../src/fetch";

const MOCK_RSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://test.com</link>
    <description>A test feed</description>
    <item>
      <title>Test Article</title>
      <link>https://test.com/article</link>
      <pubDate>Sat, 28 Nov 2025 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe("Feed Fetching", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("successful fetches", () => {
    it("fetches and parses feed from valid URL", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(MOCK_RSS, {
          status: 200,
          headers: { "Content-Type": "application/rss+xml" },
        })
      );

      const result = await fetchFeed("https://example.com/feed.xml");
      expect(result.success).toBe(true);
      expect(result.feed?.title).toBe("Test Feed");
      expect(result.items).toHaveLength(1);
    });

    it("sets appropriate User-Agent header", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(MOCK_RSS, { status: 200 })
      );

      await fetchFeed("https://example.com/feed.xml");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://example.com/feed.xml",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("rss-agent"),
          }),
        })
      );
    });

    it("handles redirects appropriately", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(MOCK_RSS, {
          status: 200,
          headers: { "Content-Type": "application/rss+xml" },
        })
      );

      const result = await fetchFeed("https://example.com/old-feed");
      expect(result.success).toBe(true);
      // fetch() handles redirects automatically
    });
  });

  describe("error handling", () => {
    it("returns feed_not_found for 404 response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("Not Found", { status: 404 })
      );

      const result = await fetchFeed("https://example.com/missing.xml");
      expect(result.success).toBe(false);
      expect(result.error).toBe("feed_not_found");
    });

    it("returns timeout error when fetch exceeds timeout", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      });

      const result = await fetchFeed("https://slow.example.com/feed.xml");
      expect(result.success).toBe(false);
      expect(result.error).toBe("timeout");
    });

    it("returns parse_error for non-feed content", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("<html><body>Not a feed</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      );

      const result = await fetchFeed("https://example.com/page.html");
      expect(result.success).toBe(false);
      expect(result.error).toBe("parse_error");
    });

    it("returns error for network failures", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await fetchFeed("https://unreachable.example.com/feed.xml");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("returns feed_not_found for 410 Gone response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("Gone", { status: 410 })
      );

      const result = await fetchFeed("https://example.com/deleted.xml");
      expect(result.success).toBe(false);
      expect(result.error).toBe("feed_not_found");
    });

    it("returns error for 500 server error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("Internal Server Error", { status: 500 })
      );

      const result = await fetchFeed("https://example.com/broken.xml");
      expect(result.success).toBe(false);
    });
  });

  describe("response metadata", () => {
    it("captures ETag from response headers", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(MOCK_RSS, {
          status: 200,
          headers: {
            "Content-Type": "application/rss+xml",
            "ETag": '"abc123"',
          },
        })
      );

      const result = await fetchFeed("https://example.com/feed.xml");
      expect(result.success).toBe(true);
      expect(result.etag).toBe('"abc123"');
    });

    it("captures Last-Modified from response headers", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(MOCK_RSS, {
          status: 200,
          headers: {
            "Content-Type": "application/rss+xml",
            "Last-Modified": "Sat, 28 Nov 2025 10:00:00 GMT",
          },
        })
      );

      const result = await fetchFeed("https://example.com/feed.xml");
      expect(result.success).toBe(true);
      expect(result.lastModified).toBe("Sat, 28 Nov 2025 10:00:00 GMT");
    });
  });
});
