import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchArticleContent } from "../src/article";

// Mock fetch for unit tests
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Article Fetching", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("fetchArticleContent", () => {
    it("fetches article content from URL", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        text: () => Promise.resolve(`
          <html>
            <head><title>Test Article</title></head>
            <body>
              <article>
                <h1>Test Article Title</h1>
                <p>This is the main content of the article.</p>
                <p>It has multiple paragraphs.</p>
              </article>
            </body>
          </html>
        `),
      });

      const result = await fetchArticleContent("https://example.com/article");

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content).toContain("main content");
      expect(result.title).toBe("Test Article");
    });

    it("extracts main text content and strips HTML", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        text: () => Promise.resolve(`
          <html>
            <body>
              <nav>Navigation menu</nav>
              <main>
                <h1>Article Title</h1>
                <p>First paragraph with <strong>bold</strong> text.</p>
                <p>Second paragraph with <a href="link">a link</a>.</p>
              </main>
              <footer>Footer content</footer>
            </body>
          </html>
        `),
      });

      const result = await fetchArticleContent("https://example.com/article");

      expect(result.success).toBe(true);
      // Should contain text content
      expect(result.content).toContain("First paragraph");
      expect(result.content).toContain("bold");
      // Should strip HTML tags
      expect(result.content).not.toContain("<p>");
      expect(result.content).not.toContain("<strong>");
    });

    it("returns error for non-existent URL (404)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "text/html" }),
      });

      const result = await fetchArticleContent("https://example.com/not-found");

      expect(result.success).toBe(false);
      expect(result.error).toBe("article_not_found");
    });

    it("returns error for server errors (500)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "text/html" }),
      });

      const result = await fetchArticleContent("https://example.com/error");

      expect(result.success).toBe(false);
      expect(result.error).toBe("content_extraction_failed");
    });

    it("handles non-HTML responses", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve('{"data": "json content"}'),
      });

      const result = await fetchArticleContent("https://api.example.com/data");

      // Should still return content for JSON
      expect(result.success).toBe(true);
      expect(result.content).toContain("json content");
    });

    it("handles plain text responses", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        text: () => Promise.resolve("Plain text article content here."),
      });

      const result = await fetchArticleContent("https://example.com/plain.txt");

      expect(result.success).toBe(true);
      expect(result.content).toBe("Plain text article content here.");
    });

    it("handles network errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await fetchArticleContent("https://example.com/article");

      expect(result.success).toBe(false);
      expect(result.error).toBe("content_extraction_failed");
      expect(result.message).toContain("Network error");
    });

    it("respects content length limits", async () => {
      const longContent = "x".repeat(100000);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        text: () => Promise.resolve(`<html><body><p>${longContent}</p></body></html>`),
      });

      const result = await fetchArticleContent("https://example.com/long-article");

      expect(result.success).toBe(true);
      // Content should be truncated
      expect(result.content!.length).toBeLessThan(100000);
    });

    it("sets appropriate User-Agent header", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        text: () => Promise.resolve("<html><body>Content</body></html>"),
      });

      await fetchArticleContent("https://example.com/article");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/article",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("RSS-Agent"),
          }),
        })
      );
    });
  });
});
