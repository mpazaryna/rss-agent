import type { HealthResponse, ErrorResponse, FeedItem } from "./types";
import { validateUrl } from "./validate";
import { fetchFeed, fetchFeedWithCache } from "./fetch";
import { checkRateLimit, incrementRateLimit } from "./ratelimit";
import { fetchArticleContent } from "./article";
import { summarizeText, SummaryStyle } from "./summarize";
import { getCachedSummary, cacheSummary } from "./summary-cache";
import { extractTopics } from "./topics";
import {
  DigestRequestBody,
  DigestSuccessResponse,
  DigestFormat,
  COLLECTIONS,
  buildDigestSections,
  formatDigestMarkdown,
  formatDigestHtml,
} from "./digest";

interface Env {
  FEED_CACHE: KVNamespace;
  AI: Ai;
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
  summarize?: boolean;
  summaryStyle?: SummaryStyle;
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

interface SummarizeRequestBody {
  url?: string;
  style?: SummaryStyle;
  forceRefresh?: boolean;
}

interface SummarizeSuccessResponse {
  success: true;
  summary: string;
  title?: string;
  url: string;
  topics?: string[];
  meta: {
    model: string;
    style: SummaryStyle;
    summarizedAt: string;
    cached: boolean;
  };
}

interface BatchSuccessResponse {
  success: true;
  results: BatchFeedResult[];
  meta: {
    totalFeeds: number;
    successCount: number;
    failureCount: number;
    totalItems: number;
    summarizedCount?: number;
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
    case "article_not_found":
      return 404;
    case "parse_error":
    case "content_extraction_failed":
      return 422;
    case "rate_limited":
      return 429;
    case "timeout":
      return 504;
    case "summarization_failed":
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

  const summaryStyle: SummaryStyle = body.summaryStyle || "brief";
  let summarizedCount = 0;

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
    let filteredItems = applyFilters(
      result.items || [],
      body.since,
      body.limit
    );

    // If summarize is requested, add AI summaries to items
    if (body.summarize) {
      const itemsWithSummaries = await Promise.all(
        filteredItems.map(async (item) => {
          try {
            // Check cache first
            const cached = await getCachedSummary(env.FEED_CACHE, item.url, summaryStyle);
            if (cached) {
              summarizedCount++;
              return { ...item, summary: cached.summary };
            }

            // Fetch article and summarize
            const articleResult = await fetchArticleContent(item.url);
            if (!articleResult.success) {
              return item; // Keep original summary from feed
            }

            const summarizeResult = await summarizeText(
              articleResult.content!,
              env.AI,
              { style: summaryStyle }
            );

            if (!summarizeResult.success) {
              return item; // Keep original summary from feed
            }

            // Cache the summary
            await cacheSummary(env.FEED_CACHE, item.url, summaryStyle, {
              summary: summarizeResult.summary!,
              title: articleResult.title,
              model: summarizeResult.model!,
            });

            summarizedCount++;
            return { ...item, summary: summarizeResult.summary! };
          } catch {
            return item; // Keep original summary on any error
          }
        })
      );
      filteredItems = itemsWithSummaries;
    }

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
      ...(body.summarize && { summarizedCount }),
    },
  };

  return jsonResponse(response);
}

async function handleDigest(request: Request, env: Env): Promise<Response> {
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
  let body: DigestRequestBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      { error: "invalid_url", message: "Invalid JSON body" },
      400
    );
  }

  // Determine feeds to fetch
  let feeds: Array<{ url: string }> = [];

  if (body.collection) {
    const collection = COLLECTIONS[body.collection];
    if (!collection) {
      return errorResponse(
        {
          error: "invalid_url",
          message: `Unknown collection: ${body.collection}. Available: ${Object.keys(COLLECTIONS).join(", ")}`,
        },
        400
      );
    }
    feeds = collection.feeds.map((f) => ({ url: f.url }));
  } else if (body.feeds && Array.isArray(body.feeds)) {
    feeds = body.feeds;
  } else {
    return errorResponse(
      {
        error: "invalid_url",
        message: "Either 'collection' or 'feeds' array is required",
      },
      400
    );
  }

  if (feeds.length === 0) {
    return errorResponse(
      { error: "invalid_url", message: "No feeds to process" },
      400
    );
  }

  const summaryStyle: SummaryStyle = body.summaryStyle || "brief";
  const format: DigestFormat = body.format || "markdown";
  const since = body.since || "24h";
  const limit = body.limit || 5;
  let summarizedCount = 0;

  // Fetch all feeds in parallel with summarization
  const fetchPromises = feeds.map(async (feed) => {
    const validation = validateUrl(feed.url);
    if (!validation.valid) {
      return { url: feed.url, success: false as const };
    }

    const result = await fetchFeedWithCache(feed.url, env.FEED_CACHE);
    if (!result.success) {
      return { url: feed.url, success: false as const };
    }

    // Apply filters
    let filteredItems = applyFilters(result.items || [], since, limit);

    // Summarize each item
    const itemsWithSummaries = await Promise.all(
      filteredItems.map(async (item) => {
        try {
          // Check cache first
          const cached = await getCachedSummary(
            env.FEED_CACHE,
            item.url,
            summaryStyle
          );
          if (cached) {
            summarizedCount++;
            return { ...item, summary: cached.summary };
          }

          // Fetch article and summarize
          const articleResult = await fetchArticleContent(item.url);
          if (!articleResult.success) {
            return item;
          }

          const summarizeResult = await summarizeText(
            articleResult.content!,
            env.AI,
            { style: summaryStyle }
          );

          if (!summarizeResult.success) {
            return item;
          }

          // Cache the summary
          await cacheSummary(env.FEED_CACHE, item.url, summaryStyle, {
            summary: summarizeResult.summary!,
            title: articleResult.title,
            model: summarizeResult.model!,
          });

          summarizedCount++;
          return { ...item, summary: summarizeResult.summary! };
        } catch {
          return item;
        }
      })
    );

    return {
      url: feed.url,
      success: true as const,
      feed: {
        title: result.feed!.title,
        url: result.feed!.url,
      },
      items: itemsWithSummaries,
    };
  });

  const results = await Promise.all(fetchPromises);

  // Build digest sections
  const sections = buildDigestSections(results);

  // Format digest
  const digestTitle =
    body.title ||
    (body.collection
      ? `${COLLECTIONS[body.collection].name} Digest`
      : "Daily Digest");

  const digest =
    format === "html"
      ? formatDigestHtml(sections, digestTitle)
      : formatDigestMarkdown(sections, digestTitle);

  const totalArticles = sections.reduce((sum, s) => sum + s.articles.length, 0);

  const response: DigestSuccessResponse = {
    success: true,
    digest,
    format,
    meta: {
      feedCount: results.filter((r) => r.success).length,
      articleCount: totalArticles,
      summarizedCount,
      generatedAt: new Date().toISOString(),
    },
  };

  return jsonResponse(response);
}

async function handleSummarize(request: Request, env: Env): Promise<Response> {
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
  let body: SummarizeRequestBody;
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

  const style: SummaryStyle = body.style || "brief";

  // Check cache first (unless forceRefresh is set)
  if (!body.forceRefresh) {
    const cached = await getCachedSummary(env.FEED_CACHE, body.url, style);
    if (cached) {
      const response: SummarizeSuccessResponse = {
        success: true,
        summary: cached.summary,
        title: cached.title,
        url: body.url,
        topics: cached.topics,
        meta: {
          model: cached.model,
          style,
          summarizedAt: new Date().toISOString(),
          cached: true,
        },
      };
      return jsonResponse(response);
    }
  }

  // Fetch article content
  const articleResult = await fetchArticleContent(body.url);
  if (!articleResult.success) {
    const status = getHttpStatus(articleResult.error || "content_extraction_failed");
    return errorResponse(
      {
        error: articleResult.error || "content_extraction_failed",
        message: articleResult.message || "Failed to fetch article",
      },
      status
    );
  }

  // Summarize the content and extract topics in parallel
  const [summarizeResult, topicsResult] = await Promise.all([
    summarizeText(articleResult.content!, env.AI, { style }),
    extractTopics(articleResult.content!, env.AI),
  ]);

  if (!summarizeResult.success) {
    return errorResponse(
      {
        error: summarizeResult.error || "summarization_failed",
        message: summarizeResult.message || "Failed to summarize article",
      },
      500
    );
  }

  // Topics are optional - don't fail if extraction fails
  const topics = topicsResult.success ? topicsResult.topics : undefined;

  // Cache the result (including topics if available)
  await cacheSummary(env.FEED_CACHE, body.url, style, {
    summary: summarizeResult.summary!,
    title: articleResult.title,
    model: summarizeResult.model!,
    topics,
  });

  const response: SummarizeSuccessResponse = {
    success: true,
    summary: summarizeResult.summary!,
    title: articleResult.title,
    url: body.url,
    topics,
    meta: {
      model: summarizeResult.model!,
      style,
      summarizedAt: new Date().toISOString(),
      cached: false,
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

    if (url.pathname === "/summarize") {
      if (request.method !== "POST") {
        return errorResponse(
          { error: "invalid_url", message: "Method not allowed" },
          405
        );
      }
      return handleSummarize(request, env);
    }

    if (url.pathname === "/digest") {
      if (request.method !== "POST") {
        return errorResponse(
          { error: "invalid_url", message: "Method not allowed" },
          405
        );
      }
      return handleDigest(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};
