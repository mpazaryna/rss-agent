import type { FeedMetadata, FeedItem, ErrorCode } from "./types";
import { parseFeed } from "./parse";
import {
  getCacheMetadata,
  getCachedFeed,
  cacheFeed,
  type CachedFeedData,
} from "./cache";

const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT = "rss-agent/1.0.0";
const ACCEPT_HEADER =
  "application/rss+xml, application/atom+xml, application/xml, text/xml, */*";

export interface FetchResult {
  success: boolean;
  feed?: FeedMetadata;
  items?: FeedItem[];
  error?: ErrorCode;
  message?: string;
  etag?: string;
  lastModified?: string;
  cached?: boolean;
}

function buildBaseHeaders(): Record<string, string> {
  return {
    "User-Agent": USER_AGENT,
    Accept: ACCEPT_HEADER,
  };
}

function handleHttpError(status: number): FetchResult {
  if (status === 404 || status === 410) {
    return {
      success: false,
      error: "feed_not_found",
      message: `Feed not found (HTTP ${status})`,
    };
  }

  return {
    success: false,
    error: "feed_not_found",
    message: `HTTP error ${status}`,
  };
}

function handleFetchError(error: unknown): FetchResult {
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

function parseAndBuildResult(
  xml: string,
  response: Response
): FetchResult {
  const parseResult = parseFeed(xml);

  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error,
      message: parseResult.message,
    };
  }

  const etag = response.headers.get("ETag") || undefined;
  const lastModified = response.headers.get("Last-Modified") || undefined;

  return {
    success: true,
    feed: parseResult.feed,
    items: parseResult.items,
    etag,
    lastModified,
  };
}

export async function fetchFeed(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: buildBaseHeaders(),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return handleHttpError(response.status);
    }

    const xml = await response.text();
    return parseAndBuildResult(xml, response);
  } catch (error) {
    clearTimeout(timeoutId);
    return handleFetchError(error);
  }
}

export async function fetchFeedWithCache(
  url: string,
  kv: KVNamespace
): Promise<FetchResult> {
  const cacheMetadata = await getCacheMetadata(kv, url);

  const headers = buildBaseHeaders();

  if (cacheMetadata.etag) {
    headers["If-None-Match"] = cacheMetadata.etag;
  }

  if (cacheMetadata.lastModified) {
    headers["If-Modified-Since"] = cacheMetadata.lastModified;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    // Handle 304 Not Modified - return cached content
    if (response.status === 304) {
      const cachedData = await getCachedFeed(kv, url);
      if (!cachedData) {
        return {
          success: false,
          error: "feed_not_found",
          message: "Received 304 but no cached content available",
        };
      }

      return {
        success: true,
        feed: cachedData.feed,
        items: cachedData.items,
        cached: true,
      };
    }

    if (!response.ok) {
      return handleHttpError(response.status);
    }

    const xml = await response.text();
    const result = parseAndBuildResult(xml, response);

    if (!result.success) {
      return result;
    }

    // Store in cache
    const cachedData: CachedFeedData = {
      feed: result.feed!,
      items: result.items!,
      cachedAt: new Date().toISOString(),
    };

    await cacheFeed(kv, url, cachedData, {
      etag: result.etag,
      lastModified: result.lastModified,
    });

    return {
      ...result,
      cached: false,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return handleFetchError(error);
  }
}
