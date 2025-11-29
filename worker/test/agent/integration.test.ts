import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseOpml } from "../../src/opml";
import { parseCollections, getCollectionById, getAllFeeds } from "../../src/collections";

const CONFIG_DIR = resolve(__dirname, "../../../config");
const WORKER_URL = "https://rss-agent-dev.mpazbot.workers.dev";

// Helper to read config files
function readOpml(): string {
  return readFileSync(resolve(CONFIG_DIR, "feeds.opml"), "utf-8");
}

function readCollections(): string {
  return readFileSync(resolve(CONFIG_DIR, "feed-collections.json"), "utf-8");
}

describe("Agent Integration", () => {
  describe("read feeds.opml and list feeds", () => {
    it("agent can read and parse feeds.opml", () => {
      const opmlContent = readOpml();
      const result = parseOpml(opmlContent);
      expect(result.success).toBe(true);
      expect(result.feeds!.length).toBeGreaterThan(0);
    });

    it("agent can list feeds by category", () => {
      const opmlContent = readOpml();
      const result = parseOpml(opmlContent);

      const categories = [...new Set(result.feeds!.map(f => f.category))];
      expect(categories.length).toBeGreaterThanOrEqual(2);

      // Each feed should have category info
      for (const feed of result.feeds!) {
        expect(feed.category).toBeDefined();
        expect(feed.text).toBeDefined();
        expect(feed.xmlUrl).toBeDefined();
      }
    });
  });

  describe("read feed-collections.json and list collections", () => {
    it("agent can read and parse feed-collections.json", () => {
      const content = readCollections();
      const result = parseCollections(content);
      expect(result.success).toBe(true);
      expect(result.data!.collections.length).toBeGreaterThan(0);
    });

    it("agent can get collection by ID", () => {
      const content = readCollections();
      const result = parseCollections(content);
      const aiCollection = getCollectionById(result.data!, "ai-ml");
      expect(aiCollection).toBeDefined();
      expect(aiCollection!.name).toBe("AI & Machine Learning");
    });

    it("agent can get all feeds from collections", () => {
      const content = readCollections();
      const result = parseCollections(content);
      const allFeeds = getAllFeeds(result.data!);
      expect(allFeeds.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("call /fetch endpoint for single feed", () => {
    it("can call /fetch endpoint with a feed URL", async () => {
      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://feeds.arstechnica.com/arstechnica/index",
          limit: 3
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as { success: boolean; items: unknown[] };
      expect(data.success).toBe(true);
      expect(data.items.length).toBeLessThanOrEqual(3);
    });
  });

  describe("call /batch endpoint for collection", () => {
    it("can call /batch endpoint with collection feeds", async () => {
      const content = readCollections();
      const result = parseCollections(content);
      const techCollection = getCollectionById(result.data!, "tech-news");

      const feedsPayload = techCollection!.feeds.map(f => ({ url: f.url }));

      const response = await fetch(`${WORKER_URL}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: feedsPayload,
          limit: 3
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as {
        success: boolean;
        meta: { totalFeeds: number; successCount: number }
      };
      expect(data.success).toBe(true);
      expect(data.meta.totalFeeds).toBe(techCollection!.feeds.length);
    });
  });

  describe("format results", () => {
    it("response includes all required metadata", async () => {
      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://feeds.arstechnica.com/arstechnica/index",
          limit: 1
        }),
      });

      const data = await response.json() as {
        success: boolean;
        feed: { title: string; url: string };
        items: Array<{ title: string; url: string; published?: string }>;
        meta: { fetchedAt: string; cached: boolean; itemCount: number };
      };

      // Verify all fields are present for markdown formatting
      expect(data.feed.title).toBeDefined();
      expect(data.meta.fetchedAt).toBeDefined();
      expect(data.meta.itemCount).toBeDefined();

      if (data.items.length > 0) {
        expect(data.items[0].title).toBeDefined();
        expect(data.items[0].url).toBeDefined();
      }
    });
  });

  describe("handle worker errors gracefully", () => {
    it("returns structured error for invalid URL", async () => {
      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "not-a-url" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as { error: string; message: string };
      expect(data.error).toBe("invalid_url");
      expect(data.message).toBeDefined();
    });

    it("returns structured error for non-feed URL", async () => {
      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      });

      expect(response.status).toBe(422);
      const data = await response.json() as { error: string; message: string };
      expect(data.error).toBe("parse_error");
    });
  });
});
