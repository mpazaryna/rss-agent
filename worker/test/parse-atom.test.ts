import { describe, it, expect } from "vitest";
import { parseFeed } from "../src/parse";

const VALID_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom Feed</title>
  <link href="https://example.com" rel="alternate"/>
  <link href="https://example.com/feed.atom" rel="self"/>
  <updated>2025-11-28T10:00:00Z</updated>
  <id>urn:uuid:12345678-1234-1234-1234-123456789012</id>
  <subtitle>An example Atom feed</subtitle>
  <entry>
    <title>First Entry</title>
    <link href="https://example.com/entry-1" rel="alternate"/>
    <id>urn:uuid:entry-1</id>
    <updated>2025-11-28T09:00:00Z</updated>
    <published>2025-11-28T09:00:00Z</published>
    <summary>This is the first entry summary.</summary>
    <author>
      <name>John Doe</name>
    </author>
    <category term="tech"/>
    <category term="ai"/>
  </entry>
  <entry>
    <title>Second Entry</title>
    <link href="https://example.com/entry-2"/>
    <id>urn:uuid:entry-2</id>
    <updated>2025-11-27T15:00:00Z</updated>
    <content type="text">This is the second entry content.</content>
  </entry>
</feed>`;

const MINIMAL_ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Minimal Atom</title>
  <id>urn:uuid:minimal</id>
  <updated>2025-11-28T00:00:00Z</updated>
</feed>`;

const ATOM_MISSING_OPTIONAL = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Sparse Atom</title>
  <id>urn:uuid:sparse</id>
  <updated>2025-11-28T00:00:00Z</updated>
  <link href="https://sparse.com"/>
  <entry>
    <title>Entry Without Date</title>
    <id>urn:uuid:entry-nodates</id>
    <link href="https://sparse.com/entry"/>
    <updated>2025-11-28T00:00:00Z</updated>
  </entry>
</feed>`;

describe("Atom Feed Parsing", () => {
  describe("valid Atom feeds", () => {
    it("extracts feed metadata (title, url, description)", () => {
      const result = parseFeed(VALID_ATOM);
      expect(result.success).toBe(true);
      expect(result.feed?.title).toBe("Example Atom Feed");
      expect(result.feed?.url).toBe("https://example.com");
      expect(result.feed?.description).toBe("An example Atom feed");
    });

    it("extracts feed lastUpdated from updated element", () => {
      const result = parseFeed(VALID_ATOM);
      expect(result.success).toBe(true);
      expect(result.feed?.lastUpdated).toBe("2025-11-28T10:00:00.000Z");
    });

    it("extracts entries with title, url, published", () => {
      const result = parseFeed(VALID_ATOM);
      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(2);
      expect(result.items![0].title).toBe("First Entry");
      expect(result.items![0].url).toBe("https://example.com/entry-1");
      expect(result.items![0].published).toBeDefined();
    });

    it("extracts item summary from summary element", () => {
      const result = parseFeed(VALID_ATOM);
      expect(result.items![0].summary).toBe("This is the first entry summary.");
    });

    it("extracts item summary from content when no summary", () => {
      const result = parseFeed(VALID_ATOM);
      expect(result.items![1].summary).toBe("This is the second entry content.");
    });

    it("extracts item author name", () => {
      const result = parseFeed(VALID_ATOM);
      expect(result.items![0].author).toBe("John Doe");
    });

    it("extracts item categories from category term attributes", () => {
      const result = parseFeed(VALID_ATOM);
      expect(result.items![0].categories).toEqual(["tech", "ai"]);
    });

    it("uses published date when available, falls back to updated", () => {
      const result = parseFeed(VALID_ATOM);
      // First entry has published
      expect(result.items![0].published).toBe("2025-11-28T09:00:00.000Z");
      // Second entry only has updated
      expect(result.items![1].published).toBe("2025-11-27T15:00:00.000Z");
    });
  });

  describe("format detection", () => {
    it("auto-detects RSS 2.0 format", () => {
      const rss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>RSS Feed</title>
    <link>https://rss.com</link>
    <description>An RSS feed</description>
  </channel>
</rss>`;
      const result = parseFeed(rss);
      expect(result.success).toBe(true);
      expect(result.feed?.title).toBe("RSS Feed");
    });

    it("auto-detects Atom format", () => {
      const result = parseFeed(VALID_ATOM);
      expect(result.success).toBe(true);
      expect(result.feed?.title).toBe("Example Atom Feed");
    });
  });

  describe("feeds with missing optional fields", () => {
    it("handles feed without entries", () => {
      const result = parseFeed(MINIMAL_ATOM);
      expect(result.success).toBe(true);
      expect(result.items).toEqual([]);
    });

    it("handles entries without published date (uses updated)", () => {
      const result = parseFeed(ATOM_MISSING_OPTIONAL);
      expect(result.success).toBe(true);
      expect(result.items![0].published).toBe("2025-11-28T00:00:00.000Z");
    });

    it("handles entries without summary or content", () => {
      const result = parseFeed(ATOM_MISSING_OPTIONAL);
      expect(result.items![0].summary).toBeUndefined();
    });

    it("handles entries without author", () => {
      const result = parseFeed(ATOM_MISSING_OPTIONAL);
      expect(result.items![0].author).toBeUndefined();
    });

    it("handles entries without categories", () => {
      const result = parseFeed(ATOM_MISSING_OPTIONAL);
      expect(result.items![0].categories).toEqual([]);
    });
  });

  describe("Atom-specific handling", () => {
    it("extracts link with rel=alternate for feed url", () => {
      const result = parseFeed(VALID_ATOM);
      expect(result.feed?.url).toBe("https://example.com");
    });

    it("handles feed with only self link (no alternate)", () => {
      const atomSelfOnly = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Self Link Only</title>
  <id>urn:uuid:self</id>
  <updated>2025-11-28T00:00:00Z</updated>
  <link href="https://example.com/feed.atom" rel="self"/>
</feed>`;
      const result = parseFeed(atomSelfOnly);
      expect(result.success).toBe(true);
      // Should fall back to self link or undefined
      expect(result.feed?.url).toBe("https://example.com/feed.atom");
    });
  });
});
