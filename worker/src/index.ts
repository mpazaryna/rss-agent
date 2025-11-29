import type { HealthResponse, ErrorResponse, FeedItem } from "./types";
import { validateUrl } from "./validate";
import { fetchFeed } from "./fetch";

interface FetchRequestBody {
  url?: string;
  since?: string;
  limit?: number;
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

async function handleFetch(request: Request): Promise<Response> {
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

  // Fetch the feed
  const result = await fetchFeed(body.url);

  if (!result.success) {
    const status = getHttpStatus(result.error || "feed_not_found");
    return errorResponse(
      { error: result.error || "feed_not_found", message: result.message || "Failed to fetch feed" },
      status
    );
  }

  // Apply filters
  let items = result.items || [];

  if (body.since) {
    items = filterItemsBySince(items, body.since);
  }

  if (body.limit && body.limit > 0) {
    items = limitItems(items, body.limit);
  }

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
      cached: false,
      itemCount: items.length,
    },
  };

  return jsonResponse(response);
}

export default {
  async fetch(request: Request): Promise<Response> {
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
      return handleFetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
