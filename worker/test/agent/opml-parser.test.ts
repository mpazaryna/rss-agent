import { describe, it, expect } from "vitest";
import { parseOpml } from "../../src/opml";
import { readFileSync } from "fs";
import { resolve } from "path";

const CONFIG_DIR = resolve(__dirname, "../../../config");

describe("OPML Parser", () => {
  describe("parseOpml", () => {
    it("parses valid OPML and extracts feed URLs", () => {
      const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test Feeds</title></head>
  <body>
    <outline text="Category" title="Category">
      <outline type="rss" text="Feed 1" xmlUrl="https://example.com/feed1.xml" htmlUrl="https://example.com"/>
      <outline type="rss" text="Feed 2" xmlUrl="https://example.com/feed2.xml" htmlUrl="https://example.com"/>
    </outline>
  </body>
</opml>`;
      const result = parseOpml(opml);
      expect(result.success).toBe(true);
      expect(result.feeds).toHaveLength(2);
      expect(result.feeds![0].xmlUrl).toBe("https://example.com/feed1.xml");
      expect(result.feeds![1].xmlUrl).toBe("https://example.com/feed2.xml");
    });

    it("extracts feed metadata (title, htmlUrl, category)", () => {
      const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test</title></head>
  <body>
    <outline text="Tech News" title="Tech News">
      <outline type="rss" text="Ars Technica" xmlUrl="https://feeds.arstechnica.com/arstechnica/index" htmlUrl="https://arstechnica.com"/>
    </outline>
  </body>
</opml>`;
      const result = parseOpml(opml);
      expect(result.success).toBe(true);
      expect(result.feeds![0].text).toBe("Ars Technica");
      expect(result.feeds![0].htmlUrl).toBe("https://arstechnica.com");
      expect(result.feeds![0].category).toBe("Tech News");
    });

    it("handles nested outline elements (categories)", () => {
      const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test</title></head>
  <body>
    <outline text="AI" title="AI">
      <outline type="rss" text="Anthropic" xmlUrl="https://anthropic.com/rss.xml" htmlUrl="https://anthropic.com"/>
    </outline>
    <outline text="Tech" title="Tech">
      <outline type="rss" text="Verge" xmlUrl="https://theverge.com/rss.xml" htmlUrl="https://theverge.com"/>
    </outline>
  </body>
</opml>`;
      const result = parseOpml(opml);
      expect(result.success).toBe(true);
      expect(result.feeds).toHaveLength(2);
      expect(result.feeds![0].category).toBe("AI");
      expect(result.feeds![1].category).toBe("Tech");
    });

    it("returns flat list of feeds with category info", () => {
      const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test</title></head>
  <body>
    <outline text="Category A" title="Category A">
      <outline type="rss" text="Feed 1" xmlUrl="https://a.com/1.xml" htmlUrl="https://a.com"/>
      <outline type="rss" text="Feed 2" xmlUrl="https://a.com/2.xml" htmlUrl="https://a.com"/>
    </outline>
    <outline text="Category B" title="Category B">
      <outline type="rss" text="Feed 3" xmlUrl="https://b.com/3.xml" htmlUrl="https://b.com"/>
    </outline>
  </body>
</opml>`;
      const result = parseOpml(opml);
      expect(result.success).toBe(true);
      expect(result.feeds).toHaveLength(3);
      // All feeds should be in a flat list
      const urls = result.feeds!.map((f) => f.xmlUrl);
      expect(urls).toContain("https://a.com/1.xml");
      expect(urls).toContain("https://a.com/2.xml");
      expect(urls).toContain("https://b.com/3.xml");
    });

    it("handles malformed OPML gracefully", () => {
      const malformedOpml = "not valid xml at all";
      const result = parseOpml(malformedOpml);
      expect(result.success).toBe(false);
      expect(result.error).toBe("parse_error");
    });

    it("handles OPML without feeds gracefully", () => {
      const emptyOpml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Empty</title></head>
  <body></body>
</opml>`;
      const result = parseOpml(emptyOpml);
      expect(result.success).toBe(true);
      expect(result.feeds).toHaveLength(0);
    });

    it("parses actual feeds.opml from config", () => {
      const opmlPath = resolve(CONFIG_DIR, "feeds.opml");
      const content = readFileSync(opmlPath, "utf-8");
      const result = parseOpml(content);
      expect(result.success).toBe(true);
      expect(result.feeds!.length).toBeGreaterThanOrEqual(6); // We have 6 feeds in our config
    });
  });
});
