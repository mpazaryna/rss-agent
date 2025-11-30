import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseOpml, getCategories } from "../../src/opml";
import { parseCollections, getCollectionById, getCollectionsByTag } from "../../src/collections";

const CONFIG_DIR = resolve(__dirname, "../../../config");
const WORKER_URL = process.env.WORKER_URL || "https://rss-agent-dev.mpazbot.workers.dev";

function readOpml(): string {
  return readFileSync(resolve(CONFIG_DIR, "feeds.opml"), "utf-8");
}

function readCollections(): string {
  return readFileSync(resolve(CONFIG_DIR, "feed-collections.json"), "utf-8");
}

describe("Example Workflows", () => {
  describe("List all feeds", () => {
    it("returns categorized feed list from OPML", () => {
      const opmlContent = readOpml();
      const result = parseOpml(opmlContent);

      expect(result.success).toBe(true);

      // Group by category
      const byCategory: Record<string, string[]> = {};
      for (const feed of result.feeds!) {
        if (!byCategory[feed.category]) {
          byCategory[feed.category] = [];
        }
        byCategory[feed.category].push(feed.text);
      }

      // Should have at least 2 categories
      const categories = Object.keys(byCategory);
      expect(categories.length).toBeGreaterThanOrEqual(2);

      // Each category should have feeds
      for (const cat of categories) {
        expect(byCategory[cat].length).toBeGreaterThan(0);
      }
    });

    it("returns categorized feed list from collections", () => {
      const content = readCollections();
      const result = parseCollections(content);

      expect(result.success).toBe(true);

      // Each collection acts as a category
      for (const collection of result.data!.collections) {
        expect(collection.name).toBeDefined();
        expect(collection.feeds.length).toBeGreaterThan(0);
      }
    });
  });

  describe("What's new in [collection]?", () => {
    it("fetches and summarizes collection feeds", async () => {
      const content = readCollections();
      const result = parseCollections(content);
      const devCollection = getCollectionById(result.data!, "dev-tools");

      expect(devCollection).toBeDefined();

      const response = await fetch(`${WORKER_URL}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: devCollection!.feeds.map(f => ({ url: f.url })),
          limit: 3
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as {
        success: boolean;
        results: Array<{
          success: boolean;
          feed?: { title: string };
          items?: Array<{ title: string }>;
        }>;
        meta: { totalItems: number };
      };

      expect(data.success).toBe(true);
      // At least some feeds should have succeeded
      const successfulFeeds = data.results.filter(r => r.success);
      expect(successfulFeeds.length).toBeGreaterThan(0);
    });
  });

  describe("Check [specific feed]", () => {
    it("fetches single feed by URL", async () => {
      // Simulate: user asks to "check Ars Technica"
      // Agent looks up URL from config
      const opmlContent = readOpml();
      const result = parseOpml(opmlContent);
      const arsFeed = result.feeds!.find(f => f.text.includes("Ars"));

      expect(arsFeed).toBeDefined();

      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: arsFeed!.xmlUrl,
          limit: 5
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as {
        success: boolean;
        feed: { title: string };
        items: Array<{ title: string; url: string }>;
      };

      expect(data.success).toBe(true);
      expect(data.feed.title).toBeDefined();
      expect(data.items.length).toBeGreaterThan(0);
    });
  });

  describe("Get AI news from last 24h", () => {
    it("uses since parameter for time filtering", async () => {
      const content = readCollections();
      const result = parseCollections(content);
      const aiCollection = getCollectionById(result.data!, "ai-ml");

      expect(aiCollection).toBeDefined();

      const response = await fetch(`${WORKER_URL}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: aiCollection!.feeds.map(f => ({ url: f.url })),
          since: "24h",
          limit: 10
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as {
        success: boolean;
        meta: { totalFeeds: number };
      };

      expect(data.success).toBe(true);
      expect(data.meta.totalFeeds).toBe(aiCollection!.feeds.length);
    });
  });

  describe("Summarize today's news (AI)", () => {
    it("fetches and summarizes collection with Workers AI", async () => {
      const content = readCollections();
      const result = parseCollections(content);
      const devCollection = getCollectionById(result.data!, "dev-tools");

      expect(devCollection).toBeDefined();

      // Use a single feed to minimize AI compute costs
      const singleFeed = devCollection!.feeds[0];

      const response = await fetch(`${WORKER_URL}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [{ url: singleFeed.url }],
          since: "7d",
          limit: 1,
          summarize: true,
          summaryStyle: "brief"
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as {
        success: boolean;
        results: Array<{
          success: boolean;
          feed?: { title: string };
          items?: Array<{ title: string; summary: string }>;
        }>;
        meta: {
          totalFeeds: number;
          successCount: number;
          totalItems: number;
          summarizedCount?: number;
        };
      };

      expect(data.success).toBe(true);

      // At least one feed should succeed
      const successfulFeeds = data.results.filter(r => r.success);
      expect(successfulFeeds.length).toBeGreaterThan(0);

      // If we got items, they should have AI-generated summaries
      if (data.meta.totalItems > 0) {
        expect(data.meta.summarizedCount).toBeGreaterThan(0);

        // Check that summaries exist and are non-empty
        const itemsWithSummaries = successfulFeeds
          .flatMap(r => r.items || [])
          .filter(item => item.summary && item.summary.length > 0);

        expect(itemsWithSummaries.length).toBeGreaterThan(0);
      }
    }, 30000); // 30s timeout for AI inference

    it("summarizes a single article via /summarize endpoint", async () => {
      // First, fetch a feed to get a real article URL
      const content = readCollections();
      const result = parseCollections(content);
      const devCollection = getCollectionById(result.data!, "dev-tools");
      const singleFeed = devCollection!.feeds[0];

      const feedResponse = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: singleFeed.url,
          limit: 1
        }),
      });

      expect(feedResponse.status).toBe(200);
      const feedData = await feedResponse.json() as {
        success: boolean;
        items: Array<{ url: string }>;
      };

      expect(feedData.success).toBe(true);
      expect(feedData.items.length).toBeGreaterThan(0);

      const articleUrl = feedData.items[0].url;

      // Now summarize the article
      const summarizeResponse = await fetch(`${WORKER_URL}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: articleUrl,
          style: "brief"
        }),
      });

      expect(summarizeResponse.status).toBe(200);
      const summaryData = await summarizeResponse.json() as {
        success: boolean;
        summary?: string;
        title?: string;
        topics?: string[];
        meta?: {
          model: string;
          style: string;
          cached: boolean;
        };
      };

      expect(summaryData.success).toBe(true);
      expect(summaryData.summary).toBeDefined();
      expect(summaryData.summary!.length).toBeGreaterThan(0);
      expect(summaryData.meta?.model).toContain("mistral");
    }, 30000); // 30s timeout for AI inference
  });

  describe("Generate email digest (AI)", () => {
    it("generates markdown digest for a collection via /digest endpoint", async () => {
      const response = await fetch(`${WORKER_URL}/digest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: "dev-tools",
          since: "7d",
          limit: 2,
          format: "markdown"
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as {
        success: boolean;
        digest: string;
        format: string;
        meta: {
          feedCount: number;
          articleCount: number;
          summarizedCount: number;
          generatedAt: string;
        };
      };

      expect(data.success).toBe(true);
      expect(data.format).toBe("markdown");
      expect(data.digest).toContain("# Development & Infrastructure Digest");
      expect(data.digest).toContain("##"); // Has section headers
      expect(data.digest).toContain("Powered by rss-agent");
      expect(data.meta.feedCount).toBeGreaterThan(0);
      expect(data.meta.generatedAt).toBeDefined();
    }, 60000); // 60s timeout for multi-feed AI processing

    it("generates html digest ready for email delivery", async () => {
      const response = await fetch(`${WORKER_URL}/digest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: "ai-ml",
          since: "7d",
          limit: 1,
          format: "html",
          title: "Weekly AI Briefing"
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as {
        success: boolean;
        digest: string;
        format: string;
        meta: {
          summarizedCount: number;
        };
      };

      expect(data.success).toBe(true);
      expect(data.format).toBe("html");
      expect(data.digest).toContain("<!DOCTYPE html>");
      expect(data.digest).toContain("Weekly AI Briefing");
      expect(data.digest).toContain("<body");
      expect(data.meta.summarizedCount).toBeGreaterThanOrEqual(0);
    }, 60000);
  });

  describe("Error cases return helpful messages", () => {
    it("invalid URL returns clear error", async () => {
      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "not-valid" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as { error: string; message: string };
      expect(data.error).toBe("invalid_url");
      expect(data.message).toBeTruthy();
    });

    it("non-feed URL returns parse error", async () => {
      const response = await fetch(`${WORKER_URL}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      });

      expect(response.status).toBe(422);
      const data = await response.json() as { error: string; message: string };
      expect(data.error).toBe("parse_error");
    });

    it("batch handles mixed success/failure", async () => {
      const response = await fetch(`${WORKER_URL}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [
            { url: "https://feeds.arstechnica.com/arstechnica/index" },
            { url: "https://example.com/not-a-feed" }
          ],
          limit: 2
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as {
        success: boolean;
        results: Array<{ success: boolean; error?: string }>;
        meta: { successCount: number; failureCount: number };
      };

      // Overall success even if some feeds fail
      expect(data.success).toBe(true);
      expect(data.meta.successCount).toBeGreaterThanOrEqual(1);
      expect(data.meta.failureCount).toBeGreaterThanOrEqual(1);
    });
  });
});
