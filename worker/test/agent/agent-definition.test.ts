import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const AGENTS_DIR = resolve(__dirname, "../../../agents");

describe("Agent Definition", () => {
  const agentPath = resolve(AGENTS_DIR, "feed-fetch.md");

  it("agent definition file exists at agents/feed-fetch.md", () => {
    expect(existsSync(agentPath)).toBe(true);
  });

  describe("required sections", () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(agentPath, "utf-8");
    });

    it("has Purpose section", () => {
      expect(content).toMatch(/##\s*Purpose/i);
    });

    it("has Tools section", () => {
      expect(content).toMatch(/##\s*Tools/i);
    });

    it("has Behavior section", () => {
      expect(content).toMatch(/##\s*Behavior/i);
    });

    it("has Examples section", () => {
      expect(content).toMatch(/##\s*Example/i);
    });
  });

  describe("worker endpoint references", () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(agentPath, "utf-8");
    });

    it("references /fetch endpoint", () => {
      expect(content).toContain("/fetch");
    });

    it("references /batch endpoint", () => {
      expect(content).toContain("/batch");
    });

    it("references dev worker URL", () => {
      expect(content).toContain("rss-agent-dev.mpazbot.workers.dev");
    });
  });

  describe("error handling guidance", () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(agentPath, "utf-8");
    });

    it("includes error handling guidance", () => {
      // Should mention error handling or how to handle failures
      expect(content).toMatch(/error|fail/i);
    });
  });
});
