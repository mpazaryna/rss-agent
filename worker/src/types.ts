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

// OPML Types
export interface OpmlFeed {
  text: string;
  xmlUrl: string;
  htmlUrl: string;
  type: string;
}

export interface OpmlCategory {
  text: string;
  title: string;
  feeds: OpmlFeed[];
}

export interface OpmlDocument {
  title: string;
  dateModified?: string;
  categories: OpmlCategory[];
}

// Feed Collection Types
export interface CollectionFeed {
  url: string;
  name: string;
}

export interface FeedCollection {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  feeds: CollectionFeed[];
}

export interface FeedCollectionsDocument {
  collections: FeedCollection[];
}
