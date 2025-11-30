import { describe, it, expect, vi } from "vitest";
import { summarizeText } from "../src/summarize";

// Mock AI binding for unit tests
function createMockAI(response: string = "This is a mock summary.") {
  return {
    run: vi.fn().mockResolvedValue({ response }),
  };
}

function createFailingMockAI(error: Error) {
  return {
    run: vi.fn().mockRejectedValue(error),
  };
}

describe("Summarization", () => {
  describe("summarizeText", () => {
    it("returns a summary string", async () => {
      const mockAI = createMockAI("Cloudflare is expanding Workers AI with new models.");
      const text = `
        Cloudflare announced today that they are expanding their Workers AI platform
        with new models and capabilities. The update includes support for larger context
        windows and improved inference speeds.
      `;

      const result = await summarizeText(text, mockAI as any);

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe("string");
      expect(result.summary!.length).toBeGreaterThan(0);
    });

    it("calls AI with correct model and messages", async () => {
      const mockAI = createMockAI();
      const text = "Test article content.";

      await summarizeText(text, mockAI as any);

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

    it("returns error for empty input", async () => {
      const mockAI = createMockAI();
      const result = await summarizeText("", mockAI as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("invalid_input");
      expect(result.message).toContain("empty");
      expect(mockAI.run).not.toHaveBeenCalled();
    });

    it("returns error for whitespace-only input", async () => {
      const mockAI = createMockAI();
      const result = await summarizeText("   \n\t  ", mockAI as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("invalid_input");
      expect(mockAI.run).not.toHaveBeenCalled();
    });

    it("truncates very long input before sending to AI", async () => {
      const mockAI = createMockAI("Summary of truncated content.");
      // Create a very long text (over 50k characters)
      const longText = "This is a test sentence. ".repeat(3000);

      const result = await summarizeText(longText, mockAI as any);

      expect(result.success).toBe(true);
      // Verify the text was truncated (check the call)
      const calledWith = mockAI.run.mock.calls[0][1].messages[1].content;
      expect(calledWith.length).toBeLessThan(longText.length);
      expect(calledWith).toContain("...");
    });

    it("supports brief style option", async () => {
      const mockAI = createMockAI("Brief summary.");
      const text = "The new framework promises to revolutionize development.";

      const result = await summarizeText(text, mockAI as any, { style: "brief" });

      expect(result.success).toBe(true);
      // Verify system prompt mentions concise/brief
      const systemPrompt = mockAI.run.mock.calls[0][1].messages[0].content;
      expect(systemPrompt.toLowerCase()).toMatch(/concise|1-2 sentences/);
    });

    it("supports detailed style option", async () => {
      const mockAI = createMockAI("Detailed comprehensive summary with all points.");
      const text = "The new framework promises to revolutionize development.";

      const result = await summarizeText(text, mockAI as any, { style: "detailed" });

      expect(result.success).toBe(true);
      const systemPrompt = mockAI.run.mock.calls[0][1].messages[0].content;
      expect(systemPrompt.toLowerCase()).toMatch(/thorough|comprehensive|paragraph/);
    });

    it("supports bullets style option", async () => {
      const mockAI = createMockAI("- Point one\n- Point two\n- Point three");
      const text = "The conference announced three major updates.";

      const result = await summarizeText(text, mockAI as any, { style: "bullets" });

      expect(result.success).toBe(true);
      const systemPrompt = mockAI.run.mock.calls[0][1].messages[0].content;
      expect(systemPrompt.toLowerCase()).toMatch(/bullet|points/);
    });

    it("returns model info in result", async () => {
      const mockAI = createMockAI();
      const text = "A short test article.";

      const result = await summarizeText(text, mockAI as any);

      expect(result.success).toBe(true);
      expect(result.model).toBeDefined();
      expect(result.model).toContain("mistralai");
    });

    it("handles AI errors gracefully", async () => {
      const mockAI = createFailingMockAI(new Error("AI service unavailable"));
      const text = "Test article content.";

      const result = await summarizeText(text, mockAI as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("summarization_failed");
      expect(result.message).toContain("unavailable");
    });
  });
});
