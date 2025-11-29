import type { FeedMetadata, FeedItem, ParseResult } from "./types";

function getTagContent(xml: string, tagName: string): string | undefined {
  // Match tag with possible attributes, handle CDATA
  const regex = new RegExp(`<${tagName}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${tagName}>`, "i");
  const match = xml.match(regex);
  if (match) {
    // Return CDATA content or regular content
    const content = match[1] ?? match[2];
    return content?.trim() || undefined;
  }
  return undefined;
}

function getAllTagContents(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${tagName}>`, "gi");
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const content = match[1] ?? match[2];
    if (content?.trim()) {
      results.push(content.trim());
    }
  }
  return results;
}

function extractItems(xml: string): string[] {
  const items: string[] = [];
  const regex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    items.push(match[1]);
  }
  return items;
}

function extractEntries(xml: string): string[] {
  const entries: string[] = [];
  const regex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    entries.push(match[1]);
  }
  return entries;
}

function parseDate(dateStr: string): string | undefined {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return undefined;
    }
    return date.toISOString();
  } catch {
    return undefined;
  }
}

function getLinkHref(xml: string, rel?: string): string | undefined {
  // Match link elements and extract href attribute
  const linkRegex = /<link([^>]*)\/?>(?:<\/link>)?/gi;
  let match;
  while ((match = linkRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
    const relMatch = attrs.match(/rel=["']([^"']*)["']/i);

    if (hrefMatch) {
      const href = hrefMatch[1];
      const linkRel = relMatch ? relMatch[1] : undefined;

      if (rel === undefined) {
        // Return first link if no rel specified
        return href;
      } else if (linkRel === rel) {
        return href;
      }
    }
  }
  return undefined;
}

function getAllCategoryTerms(xml: string): string[] {
  const categories: string[] = [];
  const categoryRegex = /<category([^>]*)\/?>(?:<\/category>)?/gi;
  let match;
  while ((match = categoryRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const termMatch = attrs.match(/term=["']([^"']*)["']/i);
    if (termMatch && termMatch[1]) {
      categories.push(termMatch[1]);
    }
  }
  return categories;
}

function getAuthorName(xml: string): string | undefined {
  const authorMatch = xml.match(/<author[^>]*>([\s\S]*?)<\/author>/i);
  if (authorMatch) {
    return getTagContent(authorMatch[1], "name");
  }
  return undefined;
}

function isAtomFeed(xml: string): boolean {
  return /<feed[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["'][^>]*>/i.test(xml) ||
         /<feed[^>]*>/i.test(xml) && xml.includes("http://www.w3.org/2005/Atom");
}

function isRssFeed(xml: string): boolean {
  return /<rss[^>]*>/i.test(xml);
}

function parseAtom(xml: string): ParseResult {
  // Extract feed content (everything inside <feed>)
  const feedMatch = xml.match(/<feed[^>]*>([\s\S]*)<\/feed>/i);
  if (!feedMatch) {
    return {
      success: false,
      error: "parse_error",
      message: "Atom feed missing feed element",
    };
  }
  const feedContent = feedMatch[1];

  // Remove entries to get feed-level metadata
  const feedWithoutEntries = feedContent.replace(/<entry[\s\S]*?<\/entry>/gi, "");

  const title = getTagContent(feedWithoutEntries, "title");
  // Try alternate link first, then self, then any link
  const url = getLinkHref(feedWithoutEntries, "alternate") ||
              getLinkHref(feedWithoutEntries, "self") ||
              getLinkHref(feedWithoutEntries);
  const description = getTagContent(feedWithoutEntries, "subtitle");
  const updated = getTagContent(feedWithoutEntries, "updated");

  if (!title) {
    return {
      success: false,
      error: "parse_error",
      message: "Atom feed missing required title",
    };
  }

  const feed: FeedMetadata = {
    title,
    url: url || "",
    description,
    lastUpdated: updated ? parseDate(updated) : undefined,
  };

  // Extract entries
  const entryContents = extractEntries(feedContent);
  const items: FeedItem[] = [];

  for (const entryContent of entryContents) {
    const entryTitle = getTagContent(entryContent, "title");
    const entryLink = getLinkHref(entryContent, "alternate") || getLinkHref(entryContent);

    if (entryTitle && entryLink) {
      const published = getTagContent(entryContent, "published");
      const entryUpdated = getTagContent(entryContent, "updated");
      const summary = getTagContent(entryContent, "summary") || getTagContent(entryContent, "content");
      const categories = getAllCategoryTerms(entryContent);

      items.push({
        title: entryTitle,
        url: entryLink,
        published: published ? parseDate(published) : (entryUpdated ? parseDate(entryUpdated) : undefined),
        summary,
        author: getAuthorName(entryContent),
        categories,
      });
    }
  }

  return {
    success: true,
    feed,
    items,
  };
}

export function parseRss(xml: string): ParseResult {
  if (!xml || xml.trim() === "") {
    return {
      success: false,
      error: "parse_error",
      message: "Empty XML content",
    };
  }

  // Check for basic XML well-formedness (very basic check)
  if (!xml.includes("<") || !xml.includes(">")) {
    return {
      success: false,
      error: "parse_error",
      message: "Malformed XML",
    };
  }

  // Check if this is RSS format
  if (!/<rss[^>]*>/i.test(xml)) {
    return {
      success: false,
      error: "parse_error",
      message: "Not a valid RSS feed",
    };
  }

  // Extract channel content
  const channelMatch = xml.match(/<channel[^>]*>([\s\S]*)<\/channel>/i);
  if (!channelMatch) {
    return {
      success: false,
      error: "parse_error",
      message: "RSS feed missing channel element",
    };
  }
  const channelContent = channelMatch[1];

  // Extract feed metadata - need to get channel-level elements, not item-level
  // Split out items first, then get channel-level metadata from what remains
  const channelWithoutItems = channelContent.replace(/<item[\s\S]*?<\/item>/gi, "");

  const title = getTagContent(channelWithoutItems, "title");
  const link = getTagContent(channelWithoutItems, "link");
  const description = getTagContent(channelWithoutItems, "description");
  const lastBuildDate = getTagContent(channelWithoutItems, "lastBuildDate");

  if (!title || !link) {
    return {
      success: false,
      error: "parse_error",
      message: "RSS feed missing required title or link",
    };
  }

  const feed: FeedMetadata = {
    title,
    url: link,
    description,
    lastUpdated: lastBuildDate ? parseDate(lastBuildDate) : undefined,
  };

  // Extract items
  const itemContents = extractItems(channelContent);
  const items: FeedItem[] = [];

  for (const itemContent of itemContents) {
    const itemTitle = getTagContent(itemContent, "title");
    const itemLink = getTagContent(itemContent, "link");

    if (itemTitle && itemLink) {
      const pubDate = getTagContent(itemContent, "pubDate");
      const categories = getAllTagContents(itemContent, "category");

      items.push({
        title: itemTitle,
        url: itemLink,
        published: pubDate ? parseDate(pubDate) : undefined,
        summary: getTagContent(itemContent, "description"),
        author: getTagContent(itemContent, "author"),
        categories,
      });
    }
  }

  return {
    success: true,
    feed,
    items,
  };
}

export function parseFeed(xml: string): ParseResult {
  if (!xml || xml.trim() === "") {
    return {
      success: false,
      error: "parse_error",
      message: "Empty XML content",
    };
  }

  // Check for basic XML well-formedness
  if (!xml.includes("<") || !xml.includes(">")) {
    return {
      success: false,
      error: "parse_error",
      message: "Malformed XML",
    };
  }

  // Auto-detect format and parse accordingly
  if (isRssFeed(xml)) {
    return parseRss(xml);
  } else if (isAtomFeed(xml)) {
    return parseAtom(xml);
  }

  return {
    success: false,
    error: "parse_error",
    message: "Unknown feed format - not RSS or Atom",
  };
}
