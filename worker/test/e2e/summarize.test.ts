import { describe, it, expect, beforeAll } from "vitest";

const WORKER_URL = process.env.WORKER_URL || "https://rss-agent-dev.mpazbot.workers.dev";

// Skip E2E tests if WORKER_URL is not set to production
const runE2E = process.env.RUN_E2E === "true";

describe.skipIf(!runE2E)("E2E: /summarize endpoint", () => {
  beforeAll(() => {
    console.log(`Testing against: ${WORKER_URL}`);
  });

  it("summarizes a real article", async () => {
    // Use a well-known, stable URL
    const response = await fetch(`${WORKER_URL}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://blog.cloudflare.com/welcome-to-the-supercloud-and-developer-week-2022/",
        style: "brief",
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.summary).toBeDefined();
    expect(typeof data.summary).toBe("string");
    expect(data.summary.length).toBeGreaterThan(20);
    expect(data.title).toBeDefined();
    expect(data.url).toBe("https://blog.cloudflare.com/welcome-to-the-supercloud-and-developer-week-2022/");
    expect(data.meta).toBeDefined();
    expect(data.meta.model).toContain("mistral");
    expect(data.meta.style).toBe("brief");
  });

  it("returns topics alongside summary", async () => {
    const response = await fetch(`${WORKER_URL}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://blog.cloudflare.com/welcome-to-the-supercloud-and-developer-week-2022/",
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.topics).toBeDefined();
    expect(Array.isArray(data.topics)).toBe(true);
  });

  it("caches summaries on repeat requests", async () => {
    const url = "https://blog.cloudflare.com/welcome-to-the-supercloud-and-developer-week-2022/";

    // First request - may or may not be cached
    const response1 = await fetch(`${WORKER_URL}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    expect(response1.status).toBe(200);
    const data1 = await response1.json();
    const summary1 = data1.summary;

    // Second request - should be cached or return same summary
    const response2 = await fetch(`${WORKER_URL}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    expect(response2.status).toBe(200);
    const data2 = await response2.json();

    // Summary should be the same
    expect(data2.summary).toBe(summary1);
    // Second request should be from cache
    expect(data2.meta.cached).toBe(true);
  });

  it("returns 400 for invalid URL", async () => {
    const response = await fetch(`${WORKER_URL}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "not-a-valid-url" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("invalid_url");
  });

  it("returns 404 for non-existent article", async () => {
    const response = await fetch(`${WORKER_URL}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/this-article-does-not-exist-12345" }),
    });

    // Should return 404 for article not found
    expect(response.status).toBe(404);
  });
});

describe.skipIf(!runE2E)("E2E: /batch with summarization", () => {
  it("batch with summarize:true includes AI summaries", async () => {
    const response = await fetch(`${WORKER_URL}/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feeds: [{ url: "https://blog.cloudflare.com/rss/" }],
        summarize: true,
        limit: 1,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.results[0].success).toBe(true);
    expect(data.results[0].items.length).toBeGreaterThan(0);
    expect(data.meta.summarizedCount).toBeDefined();
    expect(data.meta.summarizedCount).toBeGreaterThanOrEqual(0);
  });
});
