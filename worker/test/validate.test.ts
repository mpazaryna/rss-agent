import { describe, it, expect } from "vitest";
import { validateUrl } from "../src/validate";

describe("URL Validation", () => {
  describe("valid URLs", () => {
    it("accepts valid HTTP URL", () => {
      const result = validateUrl("http://example.com/feed.xml");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("accepts valid HTTPS URL", () => {
      const result = validateUrl("https://example.com/feed.xml");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("accepts URL with port", () => {
      const result = validateUrl("https://example.com:8080/feed.xml");
      expect(result.valid).toBe(true);
    });

    it("accepts URL with query parameters", () => {
      const result = validateUrl("https://example.com/feed?format=rss");
      expect(result.valid).toBe(true);
    });
  });

  describe("invalid URLs", () => {
    it("rejects empty string", () => {
      const result = validateUrl("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_url");
      expect(result.message).toBeDefined();
    });

    it("rejects malformed URL", () => {
      const result = validateUrl("not-a-url");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_url");
    });

    it("rejects URL without protocol", () => {
      const result = validateUrl("example.com/feed.xml");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_url");
    });

    it("rejects non-HTTP protocols (ftp)", () => {
      const result = validateUrl("ftp://example.com/feed.xml");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_url");
      expect(result.message).toContain("HTTP");
    });

    it("rejects non-HTTP protocols (file)", () => {
      const result = validateUrl("file:///etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_url");
    });

    it("rejects javascript protocol", () => {
      const result = validateUrl("javascript:alert(1)");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_url");
    });

    it("rejects excessively long URLs (over 2048 chars)", () => {
      const longUrl = "https://example.com/" + "a".repeat(2048);
      const result = validateUrl(longUrl);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_url");
      expect(result.message).toContain("too long");
    });
  });
});
