import type { ErrorCode } from "./types";

// Using Mistral as primary model (no Meta/Facebook models)
const PRIMARY_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

// Maximum characters to send to AI (avoid token limits)
const MAX_INPUT_LENGTH = 32000;

export type SummaryStyle = "brief" | "detailed" | "bullets";

export interface SummarizeOptions {
  style?: SummaryStyle;
}

export interface SummarizeResult {
  success: boolean;
  summary?: string;
  model?: string;
  error?: ErrorCode;
  message?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AiBinding = any;

function getSystemPrompt(style: SummaryStyle): string {
  switch (style) {
    case "brief":
      return "You are a concise summarizer. Summarize the following text in 1-2 sentences. Focus on the key point only.";
    case "detailed":
      return "You are a thorough summarizer. Summarize the following text in a comprehensive paragraph that captures all main points and supporting details.";
    case "bullets":
      return "You are a structured summarizer. Summarize the following text as 3-5 bullet points, each starting with a dash (-). Focus on the key facts and takeaways.";
    default:
      return "You are a concise summarizer. Summarize the following text in 2-3 sentences.";
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  // Truncate at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0 ? truncated.substring(0, lastSpace) + "..." : truncated + "...";
}

export async function summarizeText(
  text: string,
  ai: AiBinding,
  options: SummarizeOptions = {}
): Promise<SummarizeResult> {
  // Validate input
  const trimmedText = text.trim();
  if (!trimmedText) {
    return {
      success: false,
      error: "invalid_input" as ErrorCode,
      message: "Text is empty or contains only whitespace",
    };
  }

  const style = options.style || "brief";
  const systemPrompt = getSystemPrompt(style);

  // Truncate if too long
  const inputText = truncateText(trimmedText, MAX_INPUT_LENGTH);

  try {
    const response = await ai.run(PRIMARY_MODEL, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: inputText },
      ],
    });

    // Handle both object response (mock) and potential string response (real AI)
    const summary = typeof response === "string" ? response : response.response;

    return {
      success: true,
      summary,
      model: PRIMARY_MODEL,
    };
  } catch (error) {
    return {
      success: false,
      error: "summarization_failed" as ErrorCode,
      message: error instanceof Error ? error.message : "Failed to generate summary",
    };
  }
}
