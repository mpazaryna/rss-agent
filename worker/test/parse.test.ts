import { describe, it, expect } from "vitest";
import { parseRss } from "../src/parse";

const VALID_RSS_20 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example Blog</title>
    <link>https://example.com</link>
    <description>An example blog about things</description>
    <lastBuildDate>Sat, 28 Nov 2025 10:00:00 GMT</lastBuildDate>
    <item>
      <title>First Article</title>
      <link>https://example.com/article-1</link>
      <pubDate>Sat, 28 Nov 2025 09:00:00 GMT</pubDate>
      <description>This is the first article summary.</description>
      <author>author@example.com (John Doe)</author>
      <category>tech</category>
      <category>ai</category>
    </item>
    <item>
      <title>Second Article</title>
      <link>https://example.com/article-2</link>
      <pubDate>Fri, 27 Nov 2025 15:00:00 GMT</pubDate>
      <description>This is the second article.</description>
    </item>
  </channel>
</rss>`;

const MINIMAL_RSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Minimal Feed</title>
    <link>https://minimal.com</link>
    <description>A minimal feed</description>
  </channel>
</rss>`;

const RSS_MISSING_OPTIONAL = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Sparse Feed</title>
    <link>https://sparse.com</link>
    <description>Feed with items missing optional fields</description>
    <item>
      <title>Article Without Date</title>
      <link>https://sparse.com/article</link>
    </item>
  </channel>
</rss>`;

describe("RSS 2.0 Parsing", () => {
  describe("valid RSS 2.0", () => {
    it("extracts feed metadata (title, url, description)", () => {
      const result = parseRss(VALID_RSS_20);
      expect(result.success).toBe(true);
      expect(result.feed?.title).toBe("Example Blog");
      expect(result.feed?.url).toBe("https://example.com");
      expect(result.feed?.description).toBe("An example blog about things");
    });

    it("extracts feed lastUpdated from lastBuildDate", () => {
      const result = parseRss(VALID_RSS_20);
      expect(result.success).toBe(true);
      expect(result.feed?.lastUpdated).toBeDefined();
      // Should be ISO 8601 format
      const date = new Date(result.feed!.lastUpdated!);
      expect(date.toISOString()).toBe(result.feed!.lastUpdated);
    });

    it("extracts items with title, url, published", () => {
      const result = parseRss(VALID_RSS_20);
      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(2);
      expect(result.items![0].title).toBe("First Article");
      expect(result.items![0].url).toBe("https://example.com/article-1");
      expect(result.items![0].published).toBeDefined();
    });

    it("extracts item summary from description", () => {
      const result = parseRss(VALID_RSS_20);
      expect(result.items![0].summary).toBe("This is the first article summary.");
    });

    it("extracts item author", () => {
      const result = parseRss(VALID_RSS_20);
      expect(result.items![0].author).toBe("author@example.com (John Doe)");
    });

    it("extracts item categories as array", () => {
      const result = parseRss(VALID_RSS_20);
      expect(result.items![0].categories).toEqual(["tech", "ai"]);
    });

    it("converts pubDate to ISO 8601 format", () => {
      const result = parseRss(VALID_RSS_20);
      const published = result.items![0].published!;
      const date = new Date(published);
      expect(date.toISOString()).toBe(published);
    });
  });

  describe("feeds with missing optional fields", () => {
    it("handles feed without items", () => {
      const result = parseRss(MINIMAL_RSS);
      expect(result.success).toBe(true);
      expect(result.items).toEqual([]);
    });

    it("handles items without pubDate", () => {
      const result = parseRss(RSS_MISSING_OPTIONAL);
      expect(result.success).toBe(true);
      expect(result.items![0].published).toBeUndefined();
    });

    it("handles items without description", () => {
      const result = parseRss(RSS_MISSING_OPTIONAL);
      expect(result.items![0].summary).toBeUndefined();
    });

    it("handles items without author", () => {
      const result = parseRss(RSS_MISSING_OPTIONAL);
      expect(result.items![0].author).toBeUndefined();
    });

    it("handles items without categories", () => {
      const result = parseRss(RSS_MISSING_OPTIONAL);
      expect(result.items![0].categories).toEqual([]);
    });
  });

  describe("invalid XML", () => {
    it("returns parse_error for malformed XML", () => {
      const result = parseRss("<rss><channel><title>Broken");
      expect(result.success).toBe(false);
      expect(result.error).toBe("parse_error");
      expect(result.message).toBeDefined();
    });

    it("returns parse_error for non-RSS XML", () => {
      const result = parseRss('<?xml version="1.0"?><html><body>Not RSS</body></html>');
      expect(result.success).toBe(false);
      expect(result.error).toBe("parse_error");
      expect(result.message).toContain("RSS");
    });

    it("returns parse_error for empty string", () => {
      const result = parseRss("");
      expect(result.success).toBe(false);
      expect(result.error).toBe("parse_error");
    });
  });
});
