import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { env } from "cloudflare:test";
import {
  checkRateLimit,
  incrementRateLimit,
  RATE_LIMIT_WINDOW_SECONDS,
  RATE_LIMIT_MAX_REQUESTS,
} from "../src/ratelimit";

describe("Rate Limiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkRateLimit", () => {
    it("allows requests within rate limit", async () => {
      const clientId = "test-client-1";

      const result = await checkRateLimit(env.FEED_CACHE, clientId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeDefined();
    });

    it("returns remaining request count", async () => {
      const clientId = "test-client-2";

      const result = await checkRateLimit(env.FEED_CACHE, clientId);

      expect(result.remaining).toBe(RATE_LIMIT_MAX_REQUESTS);
    });

    it("decrements remaining after increment", async () => {
      const clientId = "test-client-3";

      await incrementRateLimit(env.FEED_CACHE, clientId);
      const result = await checkRateLimit(env.FEED_CACHE, clientId);

      expect(result.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1);
    });

    it("blocks requests exceeding rate limit", async () => {
      const clientId = "test-client-4";

      // Exhaust rate limit
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        await incrementRateLimit(env.FEED_CACHE, clientId);
      }

      const result = await checkRateLimit(env.FEED_CACHE, clientId);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("returns retryAfter seconds when rate limited", async () => {
      const clientId = "test-client-5";

      // Exhaust rate limit
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        await incrementRateLimit(env.FEED_CACHE, clientId);
      }

      const result = await checkRateLimit(env.FEED_CACHE, clientId);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(RATE_LIMIT_WINDOW_SECONDS);
    });
  });

  describe("incrementRateLimit", () => {
    it("increments the request count", async () => {
      const clientId = "test-client-6";

      await incrementRateLimit(env.FEED_CACHE, clientId);
      await incrementRateLimit(env.FEED_CACHE, clientId);

      const result = await checkRateLimit(env.FEED_CACHE, clientId);
      expect(result.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 2);
    });
  });

  describe("rate limit window expiry", () => {
    it("uses consistent key format: ratelimit:{clientId}", async () => {
      const clientId = "test-client-7";

      await incrementRateLimit(env.FEED_CACHE, clientId);

      // Verify key format
      const stored = await env.FEED_CACHE.get(`ratelimit:${clientId}`);
      expect(stored).not.toBeNull();
    });
  });

  describe("rate limit constants", () => {
    it("has sensible default rate limit", () => {
      expect(RATE_LIMIT_MAX_REQUESTS).toBeGreaterThan(0);
      expect(RATE_LIMIT_MAX_REQUESTS).toBeLessThanOrEqual(1000);
    });

    it("has sensible window duration", () => {
      expect(RATE_LIMIT_WINDOW_SECONDS).toBeGreaterThan(0);
      expect(RATE_LIMIT_WINDOW_SECONDS).toBeLessThanOrEqual(3600); // Max 1 hour
    });
  });
});
