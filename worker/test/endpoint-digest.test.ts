import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";

describe("POST /digest endpoint", () => {
  describe("validation", () => {
    it("returns 400 when neither collection nor feeds provided", async () => {
      const response = await SELF.fetch("http://localhost/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string; message: string };
      expect(data.error).toBe("invalid_url");
      expect(data.message).toContain("collection");
    });

    it("returns 400 for unknown collection", async () => {
      const response = await SELF.fetch("http://localhost/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection: "nonexistent" }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string; message: string };
      expect(data.error).toBe("invalid_url");
      expect(data.message).toContain("nonexistent");
      expect(data.message).toContain("Available");
    });

    it("returns 405 for non-POST methods", async () => {
      const response = await SELF.fetch("http://localhost/digest", {
        method: "GET",
      });
      expect(response.status).toBe(405);
    });
  });

  describe("with collection", () => {
    it("generates markdown digest for ai-ml collection", async () => {
      const response = await SELF.fetch("http://localhost/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: "ai-ml",
          since: "30d",
          limit: 1,
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        success: boolean;
        digest: string;
        format: string;
        meta: {
          feedCount: number;
          articleCount: number;
          summarizedCount: number;
          generatedAt: string;
        };
      };

      expect(data.success).toBe(true);
      expect(data.format).toBe("markdown");
      expect(data.digest).toContain("# AI & Machine Learning Digest");
      expect(data.digest).toContain("Powered by rss-agent");
      expect(data.meta.feedCount).toBeGreaterThan(0);
      expect(data.meta.generatedAt).toBeDefined();
    }, 30000);

    it("generates html digest when format=html", async () => {
      const response = await SELF.fetch("http://localhost/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: "dev-tools",
          since: "30d",
          limit: 1,
          format: "html",
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        success: boolean;
        digest: string;
        format: string;
      };

      expect(data.success).toBe(true);
      expect(data.format).toBe("html");
      expect(data.digest).toContain("<!DOCTYPE html>");
      // HTML escapes & to &amp;
      expect(data.digest).toContain("Development &amp; Infrastructure Digest");
    }, 30000);
  });

  describe("with explicit feeds", () => {
    it("generates digest from explicit feed URLs", async () => {
      const response = await SELF.fetch("http://localhost/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeds: [{ url: "https://blog.cloudflare.com/rss/" }],
          since: "30d",
          limit: 1,
          title: "Custom Digest Title",
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        success: boolean;
        digest: string;
        meta: { articleCount: number };
      };

      expect(data.success).toBe(true);
      expect(data.digest).toContain("# Custom Digest Title");
    }, 30000);
  });

  describe("meta information", () => {
    it("includes summarizedCount in meta", async () => {
      const response = await SELF.fetch("http://localhost/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: "dev-tools",
          since: "30d",
          limit: 1,
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        success: boolean;
        meta: {
          feedCount: number;
          articleCount: number;
          summarizedCount: number;
          generatedAt: string;
        };
      };

      expect(data.success).toBe(true);
      expect(typeof data.meta.summarizedCount).toBe("number");
      expect(typeof data.meta.articleCount).toBe("number");
      expect(typeof data.meta.feedCount).toBe("number");
    }, 30000);
  });
});
