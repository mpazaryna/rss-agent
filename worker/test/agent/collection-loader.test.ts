import { describe, it, expect } from "vitest";
import {
  parseCollections,
  getCollectionById,
  getAllFeeds,
  getCollectionsByTag,
} from "../../src/collections";
import { readFileSync } from "fs";
import { resolve } from "path";

const CONFIG_DIR = resolve(__dirname, "../../../config");

const sampleCollections = {
  collections: [
    {
      id: "ai-ml",
      name: "AI & Machine Learning",
      description: "AI companies",
      tags: ["ai", "ml"],
      feeds: [
        { url: "https://anthropic.com/rss.xml", name: "Anthropic" },
        { url: "https://openai.com/blog/rss.xml", name: "OpenAI" },
      ],
    },
    {
      id: "tech-news",
      name: "Tech News",
      description: "Tech coverage",
      tags: ["tech", "news"],
      feeds: [{ url: "https://arstechnica.com/rss", name: "Ars Technica" }],
    },
    {
      id: "dev-tools",
      name: "Dev Tools",
      description: "Developer tools",
      tags: ["dev", "tools"],
      feeds: [{ url: "https://blog.cloudflare.com/rss/", name: "Cloudflare" }],
    },
  ],
};

describe("Collection Loader", () => {
  describe("parseCollections", () => {
    it("loads and parses valid JSON", () => {
      const result = parseCollections(JSON.stringify(sampleCollections));
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.collections).toHaveLength(3);
    });

    it("fails on invalid JSON", () => {
      const result = parseCollections("not json");
      expect(result.success).toBe(false);
      expect(result.error).toBe("parse_error");
    });

    it("parses actual feed-collections.json from config", () => {
      const collectionsPath = resolve(CONFIG_DIR, "feed-collections.json");
      const content = readFileSync(collectionsPath, "utf-8");
      const result = parseCollections(content);
      expect(result.success).toBe(true);
      expect(result.data!.collections.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("getCollectionById", () => {
    it("returns collection when found", () => {
      const result = getCollectionById(sampleCollections, "ai-ml");
      expect(result).toBeDefined();
      expect(result!.name).toBe("AI & Machine Learning");
    });

    it("returns undefined for non-existent collection", () => {
      const result = getCollectionById(sampleCollections, "non-existent");
      expect(result).toBeUndefined();
    });
  });

  describe("getAllFeeds", () => {
    it("returns all feeds across all collections", () => {
      const feeds = getAllFeeds(sampleCollections);
      expect(feeds).toHaveLength(4);
      const urls = feeds.map((f) => f.url);
      expect(urls).toContain("https://anthropic.com/rss.xml");
      expect(urls).toContain("https://openai.com/blog/rss.xml");
      expect(urls).toContain("https://arstechnica.com/rss");
      expect(urls).toContain("https://blog.cloudflare.com/rss/");
    });

    it("returns empty array for empty collections", () => {
      const feeds = getAllFeeds({ collections: [] });
      expect(feeds).toHaveLength(0);
    });
  });

  describe("getCollectionsByTag", () => {
    it("filters collections by tag", () => {
      const result = getCollectionsByTag(sampleCollections, "ai");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ai-ml");
    });

    it("returns multiple collections matching tag", () => {
      // Both ai-ml and tech-news would match if they shared a tag
      const withSharedTag = {
        collections: [
          { id: "a", name: "A", tags: ["shared"], feeds: [] },
          { id: "b", name: "B", tags: ["shared"], feeds: [] },
        ],
      };
      const result = getCollectionsByTag(withSharedTag, "shared");
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no collections match", () => {
      const result = getCollectionsByTag(sampleCollections, "nonexistent");
      expect(result).toHaveLength(0);
    });
  });
});
