import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SELF } from "cloudflare:test";

interface ErrorResponse {
  error: string;
  message: string;
  retryAfter?: number;
}

describe("Error Response Consistency", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("400 errors - invalid_url", () => {
    it("follows error schema: { error, message }", async () => {
      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBeDefined();
      expect(data.message).toBeDefined();
      expect(typeof data.error).toBe("string");
      expect(typeof data.message).toBe("string");
    });

    it("includes descriptive message for missing URL", async () => {
      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("invalid_url");
      expect(data.message.length).toBeGreaterThan(0);
      expect(data.message).toContain("URL");
    });

    it("includes descriptive message for malformed URL", async () => {
      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "not-a-url" }),
      });

      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("invalid_url");
      expect(data.message.length).toBeGreaterThan(0);
    });

    it("includes descriptive message for invalid JSON body", async () => {
      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("invalid_url");
      expect(data.message).toContain("JSON");
    });
  });

  describe("404 errors - feed_not_found", () => {
    it("follows error schema: { error, message }", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response("Not Found", { status: 404 }))
      );

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/missing.xml" }),
      });

      expect(response.status).toBe(404);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBeDefined();
      expect(data.message).toBeDefined();
    });

    it("includes HTTP status in message", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response("Not Found", { status: 404 }))
      );

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/missing.xml" }),
      });

      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("feed_not_found");
      expect(data.message).toContain("404");
    });
  });

  describe("422 errors - parse_error", () => {
    it("follows error schema: { error, message }", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response("<html>Not RSS</html>", { status: 200 }))
      );

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/bad.xml" }),
      });

      expect(response.status).toBe(422);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBeDefined();
      expect(data.message).toBeDefined();
    });

    it("includes parse failure details in message", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response("<html>Not RSS</html>", { status: 200 }))
      );

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/bad.xml" }),
      });

      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("parse_error");
      expect(data.message.length).toBeGreaterThan(0);
    });
  });

  // Note: 429 rate_limited error tests are covered in endpoint-ratelimit.test.ts
  // They verify:
  // - error schema compliance
  // - retryAfter field inclusion
  // Skipping here to avoid test isolation issues with heavy KV usage

  describe("504 errors - timeout", () => {
    it("follows error schema: { error, message }", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        return Promise.reject(error);
      });

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://slow.com/feed.xml" }),
      });

      expect(response.status).toBe(504);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBeDefined();
      expect(data.message).toBeDefined();
    });

    it("includes timeout duration in message", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        return Promise.reject(error);
      });

      const response = await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://slow.com/feed.xml" }),
      });

      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("timeout");
      expect(data.message).toContain("timed out");
      expect(data.message).toMatch(/\d+/); // Contains a number (ms)
    });
  });

  describe("405 errors - method not allowed", () => {
    it("returns 405 for GET on /fetch", async () => {
      const response = await SELF.fetch("http://localhost/fetch", {
        method: "GET",
      });

      expect(response.status).toBe(405);
    });

    it("returns 405 for GET on /batch", async () => {
      const response = await SELF.fetch("http://localhost/batch", {
        method: "GET",
      });

      expect(response.status).toBe(405);
    });
  });

  describe("batch endpoint error consistency", () => {
    it("batch per-feed errors follow same schema", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response("Not Found", { status: 404 }))
      );

      const response = await SELF.fetch("http://localhost/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [{ url: "https://example.com/missing.xml" }],
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        results: Array<{ error?: string; message?: string }>;
      };
      expect(data.results[0].error).toBe("feed_not_found");
      expect(data.results[0].message).toBeDefined();
    });
  });
});
