import type { ErrorCode } from "./types";

const PRIMARY_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const MAX_INPUT_LENGTH = 16000; // Shorter for topic extraction

export interface TopicExtractionResult {
  success: boolean;
  topics?: string[];
  error?: ErrorCode;
  message?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AiBinding = any;

const TOPIC_EXTRACTION_PROMPT = `You are a topic extractor. Given the following text, extract 3-5 relevant topics or themes.

Rules:
1. Return ONLY a JSON array of strings
2. Each topic should be 1-3 words
3. Topics should be lowercase
4. Return between 3 and 5 topics
5. Focus on the main themes, not minor details

Example output: ["machine learning", "cloud computing", "api design"]

Do not include any other text, just the JSON array.`;

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0 ? truncated.substring(0, lastSpace) + "..." : truncated + "...";
}

function normalizeTopics(topics: string[]): string[] {
  return topics
    .map((topic) => topic.toLowerCase().trim())
    .filter((topic) => topic.length > 0)
    .slice(0, 5); // Ensure max 5 topics
}

export async function extractTopics(
  text: string,
  ai: AiBinding
): Promise<TopicExtractionResult> {
  // Validate input
  const trimmedText = text.trim();
  if (!trimmedText) {
    return {
      success: false,
      error: "invalid_input" as ErrorCode,
      message: "Text is empty or contains only whitespace",
    };
  }

  // Truncate if too long
  const inputText = truncateText(trimmedText, MAX_INPUT_LENGTH);

  try {
    const response = await ai.run(PRIMARY_MODEL, {
      messages: [
        { role: "system", content: TOPIC_EXTRACTION_PROMPT },
        { role: "user", content: inputText },
      ],
    });

    // Handle response
    const responseText = typeof response === "string" ? response : response.response;

    // Parse JSON array from response
    let topics: string[];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        throw new Error("No JSON array found in response");
      }
      topics = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(topics)) {
        throw new Error("Response is not an array");
      }
    } catch {
      return {
        success: false,
        error: "topic_extraction_failed" as ErrorCode,
        message: "Failed to parse topics from AI response",
      };
    }

    return {
      success: true,
      topics: normalizeTopics(topics),
    };
  } catch (error) {
    return {
      success: false,
      error: "topic_extraction_failed" as ErrorCode,
      message: error instanceof Error ? error.message : "Failed to extract topics",
    };
  }
}
