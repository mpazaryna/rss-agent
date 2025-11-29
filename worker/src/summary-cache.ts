import type { SummaryStyle } from "./summarize";

// 24 hours in seconds
const SUMMARY_CACHE_TTL = 86400;

export interface CachedSummary {
  summary: string;
  title?: string;
  model: string;
  topics?: string[];
}

/**
 * Generate a cache key for a summary based on URL and style
 */
export function getSummaryCacheKey(url: string, style: SummaryStyle): string {
  // Use a simple hash approach for the URL
  const urlHash = simpleHash(url);
  return `summary:${urlHash}:${style}`;
}

/**
 * Simple string hashing function
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex and ensure positive
  return Math.abs(hash).toString(16);
}

/**
 * Store a summary in the cache
 */
export async function cacheSummary(
  kv: KVNamespace,
  url: string,
  style: SummaryStyle,
  summary: CachedSummary
): Promise<void> {
  const key = getSummaryCacheKey(url, style);
  await kv.put(key, JSON.stringify(summary), { expirationTtl: SUMMARY_CACHE_TTL });
}

/**
 * Retrieve a cached summary if it exists
 */
export async function getCachedSummary(
  kv: KVNamespace,
  url: string,
  style: SummaryStyle
): Promise<CachedSummary | null> {
  const key = getSummaryCacheKey(url, style);
  const cached = await kv.get(key);

  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached) as CachedSummary;
  } catch {
    // Invalid JSON in cache, return null
    return null;
  }
}
