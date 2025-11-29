import type { HealthResponse, ErrorResponse, FeedItem } from "./types";
import { validateUrl } from "./validate";
import { fetchFeed, fetchFeedWithCache } from "./fetch";
import { checkRateLimit, incrementRateLimit } from "./ratelimit";

interface Env {
  FEED_CACHE: KVNamespace;
}

interface FetchRequestBody {
  url?: string;
  since?: string;
  limit?: number;
  forceRefresh?: boolean;
}

interface BatchFeedInput {
  url: string;
}

interface BatchRequestBody {
  feeds?: BatchFeedInput[];
  since?: string;
  limit?: number;
}

interface BatchFeedResult {
  url: string;
  success: boolean;
  feed?: {
    title: string;
    url: string;
    description?: string;
    lastUpdated?: string;
  };
  items?: FeedItem[];
  error?: string;
  message?: string;
}

interface BatchSuccessResponse {
  success: true;
  results: BatchFeedResult[];
  meta: {
    totalFeeds: number;
    successCount: number;
    failureCount: number;
    totalItems: number;
  };
}

interface FetchSuccessResponse {
  success: true;
  feed: {
    title: string;
    url: string;
    description?: string;
    lastUpdated?: string;
  };
  items: FeedItem[];
  meta: {
    fetchedAt: string;
    cached: boolean;
    itemCount: number;
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(error: ErrorResponse, status: number): Response {
  return jsonResponse(error, status);
}

function getHttpStatus(errorCode: string): number {
  switch (errorCode) {
    case "invalid_url":
      return 400;
    case "feed_not_found":
      return 404;
    case "parse_error":
      return 422;
    case "rate_limited":
      return 429;
    case "timeout":
      return 504;
    default:
      return 500;
  }
}

function filterItemsBySince(items: FeedItem[], since: string): FeedItem[] {
  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) {
    return items;
  }
  return items.filter((item) => {
    if (!item.published) return true;
    const itemDate = new Date(item.published);
    return itemDate >= sinceDate;
  });
}

function limitItems(items: FeedItem[], limit: number): FeedItem[] {
  return items.slice(0, limit);
}

function parseShorthandSince(since: string): string {
  // Handle shorthand since values: 24h, 7d, 30d
  const match = since.match(/^(\d+)([hd])$/);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const now = new Date();

    if (unit === "h") {
      now.setHours(now.getHours() - value);
    } else if (unit === "d") {
      now.setDate(now.getDate() - value);
    }

    return now.toISOString();
  }

  // Return as-is if not shorthand
  return since;
}

function applyFilters(
  items: FeedItem[],
  since?: string,
  limit?: number
): FeedItem[] {
  let filtered = items;

  if (since) {
    const parsedSince = parseShorthandSince(since);
    filtered = filterItemsBySince(filtered, parsedSince);
  }

  if (limit && limit > 0) {
    filtered = limitItems(filtered, limit);
  }

  return filtered;
}

function getClientId(request: Request): string {
  // Use X-Client-ID header if provided, otherwise use CF-Connecting-IP or fallback
  const clientIdHeader = request.headers.get("X-Client-ID");
  if (clientIdHeader) {
    return clientIdHeader;
  }

  const cfConnectingIp = request.headers.get("CF-Connecting-IP");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback for local development
  return "anonymous";
}

async function handleFetch(request: Request, env: Env): Promise<Response> {
  // Check rate limit
  const clientId = getClientId(request);
  const rateLimitResult = await checkRateLimit(env.FEED_CACHE, clientId);

  if (!rateLimitResult.allowed) {
    return errorResponse(
      {
        error: "rate_limited",
        message: "Too many requests",
        retryAfter: rateLimitResult.retryAfter,
      },
      429
    );
  }

  // Increment rate limit counter
  await incrementRateLimit(env.FEED_CACHE, clientId);

  // Parse request body
  let body: FetchRequestBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      { error: "invalid_url", message: "Invalid JSON body" },
      400
    );
  }

  // Validate URL
  if (!body.url) {
    return errorResponse(
      { error: "invalid_url", message: "URL is required" },
      400
    );
  }

  const validation = validateUrl(body.url);
  if (!validation.valid) {
    return errorResponse(
      { error: "invalid_url", message: validation.message || "Invalid URL" },
      400
    );
  }

  // Fetch the feed - use cache unless forceRefresh is true
  const result = body.forceRefresh
    ? await fetchFeed(body.url)
    : await fetchFeedWithCache(body.url, env.FEED_CACHE);

  if (!result.success) {
    const status = getHttpStatus(result.error || "feed_not_found");
    return errorResponse(
      { error: result.error || "feed_not_found", message: result.message || "Failed to fetch feed" },
      status
    );
  }

  // Apply filters using shared function
  const items = applyFilters(result.items || [], body.since, body.limit);

  const response: FetchSuccessResponse = {
    success: true,
    feed: {
      title: result.feed!.title,
      url: result.feed!.url,
      description: result.feed!.description,
      lastUpdated: result.feed!.lastUpdated,
    },
    items,
    meta: {
      fetchedAt: new Date().toISOString(),
      cached: result.cached ?? false,
      itemCount: items.length,
    },
  };

  return jsonResponse(response);
}

async function handleBatch(request: Request, env: Env): Promise<Response> {
  // Check rate limit
  const clientId = getClientId(request);
  const rateLimitResult = await checkRateLimit(env.FEED_CACHE, clientId);

  if (!rateLimitResult.allowed) {
    return errorResponse(
      {
        error: "rate_limited",
        message: "Too many requests",
        retryAfter: rateLimitResult.retryAfter,
      },
      429
    );
  }

  // Increment rate limit counter
  await incrementRateLimit(env.FEED_CACHE, clientId);

  // Parse request body
  let body: BatchRequestBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      { error: "invalid_url", message: "Invalid JSON body" },
      400
    );
  }

  // Validate feeds array
  if (!body.feeds || !Array.isArray(body.feeds)) {
    return errorResponse(
      { error: "invalid_url", message: "feeds array is required" },
      400
    );
  }

  if (body.feeds.length === 0) {
    return errorResponse(
      { error: "invalid_url", message: "feeds array cannot be empty" },
      400
    );
  }

  // Fetch all feeds in parallel
  const fetchPromises = body.feeds.map(async (feed): Promise<BatchFeedResult> => {
    // Validate URL
    const validation = validateUrl(feed.url);
    if (!validation.valid) {
      return {
        url: feed.url,
        success: false,
        error: "invalid_url",
        message: validation.message || "Invalid URL",
      };
    }

    // Fetch the feed
    const result = await fetchFeedWithCache(feed.url, env.FEED_CACHE);

    if (!result.success) {
      return {
        url: feed.url,
        success: false,
        error: result.error,
        message: result.message,
      };
    }

    // Apply filters
    const filteredItems = applyFilters(
      result.items || [],
      body.since,
      body.limit
    );

    return {
      url: feed.url,
      success: true,
      feed: {
        title: result.feed!.title,
        url: result.feed!.url,
        description: result.feed!.description,
        lastUpdated: result.feed!.lastUpdated,
      },
      items: filteredItems,
    };
  });

  const results = await Promise.all(fetchPromises);

  // Calculate meta statistics
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;
  const totalItems = results.reduce(
    (sum, r) => sum + (r.items?.length || 0),
    0
  );

  const response: BatchSuccessResponse = {
    success: true,
    results,
    meta: {
      totalFeeds: body.feeds.length,
      successCount,
      failureCount,
      totalItems,
    },
  };

  return jsonResponse(response);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      const response: HealthResponse = {
        status: "ok",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
      };
      return jsonResponse(response);
    }

    if (url.pathname === "/fetch") {
      if (request.method !== "POST") {
        return errorResponse(
          { error: "invalid_url", message: "Method not allowed" },
          405
        );
      }
      return handleFetch(request, env);
    }

    if (url.pathname === "/batch") {
      if (request.method !== "POST") {
        return errorResponse(
          { error: "invalid_url", message: "Method not allowed" },
          405
        );
      }
      return handleBatch(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};
