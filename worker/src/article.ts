import type { ErrorCode } from "./types";

const USER_AGENT = "RSS-Agent/1.0 (Cloudflare Worker; +https://github.com/mpazaryna/rss-agent)";
const MAX_CONTENT_LENGTH = 50000; // 50k characters max
const FETCH_TIMEOUT = 10000; // 10 seconds

export interface ArticleFetchResult {
  success: boolean;
  content?: string;
  title?: string;
  error?: ErrorCode;
  message?: string;
}

/**
 * Strip HTML tags and extract text content
 */
function stripHtml(html: string): string {
  // Remove script and style elements entirely
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Extract title from HTML
 */
function extractTitle(html: string): string | undefined {
  // Try <title> tag first
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return stripHtml(titleMatch[1]).trim();
  }

  // Try <h1> tag
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return stripHtml(h1Match[1]).trim();
  }

  // Try og:title meta tag
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitleMatch) {
    return ogTitleMatch[1].trim();
  }

  return undefined;
}

/**
 * Extract main content from HTML
 * Prioritizes article, main, and content elements
 */
function extractMainContent(html: string): string {
  // Try to find main content areas
  const contentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]+class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+id=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const content = stripHtml(match[1]);
      if (content.length > 100) { // Only use if substantial content
        return content;
      }
    }
  }

  // Fall back to body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return stripHtml(bodyMatch[1]);
  }

  // Last resort: strip all HTML from entire document
  return stripHtml(html);
}

/**
 * Fetch article content from a URL
 */
export async function fetchArticleContent(url: string): Promise<ArticleFetchResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: "article_not_found",
          message: `Article not found (HTTP ${response.status})`,
        };
      }
      return {
        success: false,
        error: "content_extraction_failed",
        message: `HTTP error ${response.status}`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    const rawContent = await response.text();

    let content: string;
    let title: string | undefined;

    if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
      // HTML content - extract and strip
      content = extractMainContent(rawContent);
      title = extractTitle(rawContent);
    } else {
      // Plain text or other - use as-is
      content = rawContent;
    }

    // Truncate if too long
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.substring(0, MAX_CONTENT_LENGTH) + "...";
    }

    return {
      success: true,
      content,
      title,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "timeout",
        message: "Request timed out",
      };
    }

    return {
      success: false,
      error: "content_extraction_failed",
      message: error instanceof Error ? error.message : "Failed to fetch article",
    };
  }
}
