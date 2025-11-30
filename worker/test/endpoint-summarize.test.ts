import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SELF } from "cloudflare:test";

// Type for summarize success response
interface SummarizeResponse {
  success: boolean;
  summary?: string;
  title?: string;
  url?: string;
  error?: string;
  message?: string;
  meta?: {
    model: string;
    style: string;
    summarizedAt: string;
  };
}

// Mock HTML for article fetching
const MOCK_ARTICLE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Test Article Title</title></head>
<body>
  <article>
    <h1>Test Article Title</h1>
    <p>This is the main content of the test article. It contains important information about technology and innovation.</p>
  </article>
</body>
</html>
`;

// Mock the AI binding response
const mockAiRun = vi.fn();

describe("POST /summarize endpoint", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockAiRun.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns summary for valid URL", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/article") {
        return Promise.resolve(new Response(MOCK_ARTICLE_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        }));
      }
      return originalFetch(url);
    });

    const response = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/article" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json() as SummarizeResponse;
    expect(data.success).toBe(true);
    expect(data.summary).toBeDefined();
    expect(data.title).toBe("Test Article Title");
    expect(data.url).toBe("https://example.com/article");
  });

  it("response includes meta with model and style", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/article") {
        return Promise.resolve(new Response(MOCK_ARTICLE_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        }));
      }
      return originalFetch(url);
    });

    const response = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/article", style: "detailed" }),
    });

    const data = await response.json() as SummarizeResponse;
    expect(data.meta).toBeDefined();
    expect(data.meta!.model).toContain("mistral");
    expect(data.meta!.style).toBe("detailed");
    expect(data.meta!.summarizedAt).toBeDefined();
  });

  it("supports style parameter (brief, detailed, bullets)", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/article") {
        return Promise.resolve(new Response(MOCK_ARTICLE_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        }));
      }
      return originalFetch(url);
    });

    const response = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/article", style: "bullets" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json() as SummarizeResponse;
    expect(data.meta!.style).toBe("bullets");
  });

  it("returns 400 for missing URL", async () => {
    const response = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = await response.json() as SummarizeResponse;
    expect(data.error).toBe("invalid_url");
  });

  it("returns 400 for invalid URL", async () => {
    const response = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "not-a-valid-url" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json() as SummarizeResponse;
    expect(data.error).toBe("invalid_url");
  });

  it("returns 404 for article not found", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/not-found") {
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      }
      return originalFetch(url);
    });

    const response = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/not-found" }),
    });

    expect(response.status).toBe(404);
    const data = await response.json() as SummarizeResponse;
    expect(data.error).toBe("article_not_found");
  });

  it("returns 422 for content extraction failure (server error)", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "https://example.com/bad-content") {
        return Promise.resolve(new Response("Server Error", { status: 500 }));
      }
      return originalFetch(url);
    });

    const response = await SELF.fetch("http://localhost/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/bad-content" }),
    });

    expect(response.status).toBe(422);
    const data = await response.json() as SummarizeResponse;
    expect(data.error).toBe("content_extraction_failed");
  });

  it("returns 405 for non-POST method", async () => {
    const response = await SELF.fetch("http://localhost/summarize", {
      method: "GET",
    });

    expect(response.status).toBe(405);
  });
});
