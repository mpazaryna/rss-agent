import type { ErrorCode } from "./types";

export interface OpmlParsedFeed {
  text: string;
  xmlUrl: string;
  htmlUrl: string;
  type: string;
  category: string;
}

export interface OpmlParseResult {
  success: boolean;
  feeds?: OpmlParsedFeed[];
  error?: ErrorCode;
  message?: string;
}

/**
 * Parse OPML 2.0 format and extract feeds with their categories
 * Uses regex-based parsing consistent with existing RSS/Atom parsers
 */
export function parseOpml(opmlContent: string): OpmlParseResult {
  try {
    // Verify it's XML
    if (!opmlContent.includes("<?xml") && !opmlContent.includes("<opml")) {
      return {
        success: false,
        error: "parse_error",
        message: "Content is not valid OPML XML",
      };
    }

    const feeds: OpmlParsedFeed[] = [];

    // Find all category outlines (those with nested outlines)
    // Pattern: <outline text="Category" title="Category">...nested feeds...</outline>
    const categoryPattern =
      /<outline[^>]+text="([^"]*)"[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/outline>/g;

    let categoryMatch;
    while ((categoryMatch = categoryPattern.exec(opmlContent)) !== null) {
      const categoryText = categoryMatch[1];
      const categoryContent = categoryMatch[3];

      // Find all feed outlines within this category
      // Pattern: <outline type="rss" text="..." xmlUrl="..." htmlUrl="..."/>
      const feedPattern =
        /<outline[^>]+type="rss"[^>]+text="([^"]*)"[^>]+xmlUrl="([^"]*)"[^>]+htmlUrl="([^"]*)"/g;

      let feedMatch;
      while ((feedMatch = feedPattern.exec(categoryContent)) !== null) {
        feeds.push({
          text: feedMatch[1],
          xmlUrl: feedMatch[2],
          htmlUrl: feedMatch[3],
          type: "rss",
          category: categoryText,
        });
      }
    }

    return {
      success: true,
      feeds,
    };
  } catch (error) {
    return {
      success: false,
      error: "parse_error",
      message: error instanceof Error ? error.message : "Unknown parse error",
    };
  }
}

/**
 * Get all unique categories from OPML
 */
export function getCategories(opmlContent: string): string[] {
  const result = parseOpml(opmlContent);
  if (!result.success || !result.feeds) {
    return [];
  }
  return [...new Set(result.feeds.map((f) => f.category))];
}

/**
 * Get feeds by category
 */
export function getFeedsByCategory(
  opmlContent: string,
  category: string
): OpmlParsedFeed[] {
  const result = parseOpml(opmlContent);
  if (!result.success || !result.feeds) {
    return [];
  }
  return result.feeds.filter((f) => f.category === category);
}
