import type { ValidationResult } from "./types";

const MAX_URL_LENGTH = 2048;

export function validateUrl(url: string): ValidationResult {
  // Check for empty string
  if (!url || url.trim() === "") {
    return {
      valid: false,
      error: "invalid_url",
      message: "URL cannot be empty",
    };
  }

  // Check URL length
  if (url.length > MAX_URL_LENGTH) {
    return {
      valid: false,
      error: "invalid_url",
      message: "URL is too long (max 2048 characters)",
    };
  }

  // Try to parse the URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      valid: false,
      error: "invalid_url",
      message: "Malformed URL",
    };
  }

  // Check protocol is HTTP or HTTPS
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: "invalid_url",
      message: "Only HTTP and HTTPS protocols are allowed",
    };
  }

  return { valid: true };
}
