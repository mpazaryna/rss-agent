import { describe, it, expect, vi } from "vitest";
import { extractTopics } from "../src/topics";

// Mock AI binding for unit tests
function createMockAI(response: string = '["ai", "cloudflare", "technology"]') {
  return {
    run: vi.fn().mockResolvedValue({ response }),
  };
}

function createFailingMockAI(error: Error) {
  return {
    run: vi.fn().mockRejectedValue(error),
  };
}

describe("Topic Extraction", () => {
  describe("extractTopics", () => {
    it("returns array of topics from article content", async () => {
      const mockAI = createMockAI();
      const text = `
        Cloudflare announced today that they are expanding their Workers AI platform
        with new models and capabilities. The update includes support for larger context
        windows and improved inference speeds.
      `;

      const result = await extractTopics(text, mockAI as any);

      expect(result.success).toBe(true);
      expect(result.topics).toBeDefined();
      expect(Array.isArray(result.topics)).toBe(true);
      expect(result.topics!.length).toBeGreaterThan(0);
    });

    it("returns 3-5 relevant topics", async () => {
      const mockAI = createMockAI('["ai", "cloud computing", "edge networks", "machine learning", "performance"]');
      const text = "Article about AI and cloud computing.";

      const result = await extractTopics(text, mockAI as any);

      expect(result.success).toBe(true);
      expect(result.topics!.length).toBeGreaterThanOrEqual(3);
      expect(result.topics!.length).toBeLessThanOrEqual(5);
    });

    it("topics are normalized (lowercase, trimmed)", async () => {
      const mockAI = createMockAI('["  AI  ", "Cloud Computing", "EDGE NETWORKS"]');
      const text = "Article content.";

      const result = await extractTopics(text, mockAI as any);

      expect(result.success).toBe(true);
      for (const topic of result.topics!) {
        expect(topic).toBe(topic.toLowerCase().trim());
      }
    });

    it("returns error for empty input", async () => {
      const mockAI = createMockAI();
      const result = await extractTopics("", mockAI as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("invalid_input");
      expect(mockAI.run).not.toHaveBeenCalled();
    });

    it("handles AI errors gracefully", async () => {
      const mockAI = createFailingMockAI(new Error("AI service unavailable"));
      const text = "Test article content.";

      const result = await extractTopics(text, mockAI as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("topic_extraction_failed");
    });

    it("handles non-JSON AI responses gracefully", async () => {
      const mockAI = createMockAI("This is not JSON");
      const text = "Test article content.";

      const result = await extractTopics(text, mockAI as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("topic_extraction_failed");
    });

    it("calls AI with appropriate model", async () => {
      const mockAI = createMockAI();
      const text = "Test article content.";

      await extractTopics(text, mockAI as any);

      expect(mockAI.run).toHaveBeenCalledWith(
        "@cf/mistralai/mistral-small-3.1-24b-instruct",
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "system" }),
            expect.objectContaining({ role: "user", content: text }),
          ]),
        })
      );
    });
  });
});
