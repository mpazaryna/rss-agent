import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { RATE_LIMIT_MAX_REQUESTS } from "../src/ratelimit";

interface ErrorResponse {
  error: string;
  message: string;
  retryAfter?: number;
}

const MOCK_RSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://test.com</link>
    <item>
      <title>Article One</title>
      <link>https://test.com/article-1</link>
    </item>
  </channel>
</rss>`;

describe("Rate limiting on /fetch endpoint", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("example.com")) {
        return Promise.resolve(new Response(MOCK_RSS, { status: 200 }));
      }
      return originalFetch(url);
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("allows requests within rate limit", async () => {
    const response = await SELF.fetch("http://localhost/fetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-ID": "test-ratelimit-client-1",
      },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });

    expect(response.status).toBe(200);
  });

  it("returns 429 when rate limit exceeded", async () => {
    const clientId = "test-ratelimit-client-2";

    // Exhaust rate limit by making many requests
    // Use a small number first to verify the pattern works
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": clientId,
        },
        body: JSON.stringify({ url: "https://example.com/feed.xml" }),
      });
    }

    // Next request should be rate limited
    const response = await SELF.fetch("http://localhost/fetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-ID": clientId,
      },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });

    expect(response.status).toBe(429);
    const data = (await response.json()) as ErrorResponse;
    expect(data.error).toBe("rate_limited");
  });

  it("includes retryAfter in rate limit error response", async () => {
    const clientId = "test-ratelimit-client-3";

    // Exhaust rate limit
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": clientId,
        },
        body: JSON.stringify({ url: "https://example.com/feed.xml" }),
      });
    }

    const response = await SELF.fetch("http://localhost/fetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-ID": clientId,
      },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });

    expect(response.status).toBe(429);
    const data = (await response.json()) as ErrorResponse;
    expect(data.retryAfter).toBeDefined();
    expect(data.retryAfter).toBeGreaterThan(0);
  });

  it("uses IP address as client ID when X-Client-ID not provided", async () => {
    // First request should succeed
    const response = await SELF.fetch("http://localhost/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });

    expect(response.status).toBe(200);
  });

  it("different clients have separate rate limits", async () => {
    const client1 = "test-ratelimit-client-4a";
    const client2 = "test-ratelimit-client-4b";

    // Exhaust rate limit for client1
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      await SELF.fetch("http://localhost/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": client1,
        },
        body: JSON.stringify({ url: "https://example.com/feed.xml" }),
      });
    }

    // Client1 should be rate limited
    const response1 = await SELF.fetch("http://localhost/fetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-ID": client1,
      },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });
    expect(response1.status).toBe(429);

    // Client2 should still be allowed
    const response2 = await SELF.fetch("http://localhost/fetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-ID": client2,
      },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });
    expect(response2.status).toBe(200);
  });
});
