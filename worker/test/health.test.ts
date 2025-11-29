import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";
import type { HealthResponse } from "../src/types";

describe("GET /health", () => {
  it("responds with 200 status", async () => {
    const response = await SELF.fetch("http://localhost/health");
    expect(response.status).toBe(200);
  });

  it("returns JSON with status: ok", async () => {
    const response = await SELF.fetch("http://localhost/health");
    const data = (await response.json()) as HealthResponse;
    expect(data.status).toBe("ok");
  });

  it("returns JSON with version field", async () => {
    const response = await SELF.fetch("http://localhost/health");
    const data = (await response.json()) as HealthResponse;
    expect(data.version).toBeDefined();
    expect(typeof data.version).toBe("string");
    expect(data.version).toBe("1.0.0");
  });

  it("returns JSON with valid ISO 8601 timestamp", async () => {
    const response = await SELF.fetch("http://localhost/health");
    const data = (await response.json()) as HealthResponse;
    expect(data.timestamp).toBeDefined();
    expect(typeof data.timestamp).toBe("string");
    // Validate ISO 8601 format
    const date = new Date(data.timestamp);
    expect(date.toISOString()).toBe(data.timestamp);
  });

  it("sets Content-Type to application/json", async () => {
    const response = await SELF.fetch("http://localhost/health");
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });
});
