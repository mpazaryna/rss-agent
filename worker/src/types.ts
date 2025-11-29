export interface HealthResponse {
  status: "ok";
  version: string;
  timestamp: string;
}

export type ErrorCode = "invalid_url" | "feed_not_found" | "parse_error" | "rate_limited" | "timeout";

export interface ErrorResponse {
  error: ErrorCode;
  message: string;
  retryAfter?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: ErrorCode;
  message?: string;
}

export interface FeedMetadata {
  title: string;
  url: string;
  description?: string;
  lastUpdated?: string;
}

export interface FeedItem {
  title: string;
  url: string;
  published?: string;
  summary?: string;
  author?: string;
  categories: string[];
}

export interface ParseResult {
  success: boolean;
  feed?: FeedMetadata;
  items?: FeedItem[];
  error?: ErrorCode;
  message?: string;
}
