import type { FeedMetadata, FeedItem, ErrorCode } from "./types";
import { parseFeed } from "./parse";

const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT = "rss-agent/1.0.0";

export interface FetchResult {
  success: boolean;
  feed?: FeedMetadata;
  items?: FeedItem[];
  error?: ErrorCode;
  message?: string;
  etag?: string;
  lastModified?: string;
}

export async function fetchFeed(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });

    clearTimeout(timeoutId);

    // Handle HTTP errors
    if (response.status === 404 || response.status === 410) {
      return {
        success: false,
        error: "feed_not_found",
        message: `Feed not found (HTTP ${response.status})`,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: "feed_not_found",
        message: `HTTP error ${response.status}`,
      };
    }

    // Get response body
    const xml = await response.text();

    // Parse the feed
    const parseResult = parseFeed(xml);

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error,
        message: parseResult.message,
      };
    }

    // Extract caching headers
    const etag = response.headers.get("ETag") || undefined;
    const lastModified = response.headers.get("Last-Modified") || undefined;

    return {
      success: true,
      feed: parseResult.feed,
      items: parseResult.items,
      etag,
      lastModified,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          error: "timeout",
          message: `Request timed out after ${FETCH_TIMEOUT_MS}ms`,
        };
      }

      return {
        success: false,
        error: "feed_not_found",
        message: error.message,
      };
    }

    return {
      success: false,
      error: "feed_not_found",
      message: "Unknown error occurred",
    };
  }
}
