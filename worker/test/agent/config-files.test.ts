import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Path to config directory (relative to worker directory)
const CONFIG_DIR = resolve(__dirname, "../../../config");

describe("Feed Configuration Files", () => {
  describe("feeds.opml", () => {
    const opmlPath = resolve(CONFIG_DIR, "feeds.opml");

    it("file exists", () => {
      expect(existsSync(opmlPath)).toBe(true);
    });

    it("is valid OPML 2.0 format", () => {
      const content = readFileSync(opmlPath, "utf-8");
      expect(content).toContain('<?xml version="1.0"');
      expect(content).toContain('<opml version="2.0">');
      expect(content).toContain("<head>");
      expect(content).toContain("<body>");
      expect(content).toContain("</opml>");
    });

    it("contains at least 2 feed categories", () => {
      const content = readFileSync(opmlPath, "utf-8");
      // Categories are top-level outline elements with nested outlines
      const categoryMatches = content.match(
        /<outline[^>]+text="[^"]+"\s*title="[^"]+"\s*>/g
      );
      expect(categoryMatches).not.toBeNull();
      expect(categoryMatches!.length).toBeGreaterThanOrEqual(2);
    });

    it("each feed has required attributes: xmlUrl, text, htmlUrl", () => {
      const content = readFileSync(opmlPath, "utf-8");
      // Find all feed outlines (those with type="rss")
      const feedMatches = content.match(/<outline[^>]+type="rss"[^>]*\/>/g);
      expect(feedMatches).not.toBeNull();
      expect(feedMatches!.length).toBeGreaterThan(0);

      for (const feed of feedMatches!) {
        expect(feed).toMatch(/xmlUrl="[^"]+"/);
        expect(feed).toMatch(/text="[^"]+"/);
        expect(feed).toMatch(/htmlUrl="[^"]+"/);
      }
    });
  });

  describe("feed-collections.json", () => {
    const collectionsPath = resolve(CONFIG_DIR, "feed-collections.json");

    it("file exists", () => {
      expect(existsSync(collectionsPath)).toBe(true);
    });

    it("is valid JSON", () => {
      const content = readFileSync(collectionsPath, "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it("has collections array at root", () => {
      const content = readFileSync(collectionsPath, "utf-8");
      const data = JSON.parse(content);
      expect(data).toHaveProperty("collections");
      expect(Array.isArray(data.collections)).toBe(true);
    });

    it("collections have required fields: id, name, feeds[]", () => {
      const content = readFileSync(collectionsPath, "utf-8");
      const data = JSON.parse(content);

      for (const collection of data.collections) {
        expect(collection).toHaveProperty("id");
        expect(typeof collection.id).toBe("string");
        expect(collection).toHaveProperty("name");
        expect(typeof collection.name).toBe("string");
        expect(collection).toHaveProperty("feeds");
        expect(Array.isArray(collection.feeds)).toBe(true);
      }
    });

    it("each feed in collection has url and name", () => {
      const content = readFileSync(collectionsPath, "utf-8");
      const data = JSON.parse(content);

      for (const collection of data.collections) {
        for (const feed of collection.feeds) {
          expect(feed).toHaveProperty("url");
          expect(typeof feed.url).toBe("string");
          expect(feed).toHaveProperty("name");
          expect(typeof feed.name).toBe("string");
        }
      }
    });

    it("has at least 3 collections", () => {
      const content = readFileSync(collectionsPath, "utf-8");
      const data = JSON.parse(content);
      expect(data.collections.length).toBeGreaterThanOrEqual(3);
    });
  });
});
