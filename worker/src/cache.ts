import type { FeedMetadata, FeedItem } from "./types";

// Default cache TTL: 15 minutes in seconds
export const DEFAULT_CACHE_TTL = 900;

export interface CachedFeedData {
  feed: FeedMetadata;
  items: FeedItem[];
  cachedAt: string;
}

export interface CacheMetadata {
  etag: string | null;
  lastModified: string | null;
}

export interface CacheOptions {
  etag?: string;
  lastModified?: string;
  ttl?: number;
}

export async function generateCacheKey(url: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(url);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `feed:${hashHex}`;
}

export async function getCachedFeed(
  kv: KVNamespace,
  url: string
): Promise<CachedFeedData | null> {
  const key = await generateCacheKey(url);
  const cached = await kv.get(`${key}:content`);

  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached) as CachedFeedData;
  } catch {
    return null;
  }
}

export async function cacheFeed(
  kv: KVNamespace,
  url: string,
  data: CachedFeedData,
  options?: CacheOptions
): Promise<void> {
  const key = await generateCacheKey(url);
  const ttl = options?.ttl ?? DEFAULT_CACHE_TTL;

  // Store the feed content
  await kv.put(`${key}:content`, JSON.stringify(data), {
    expirationTtl: ttl,
  });

  // Store ETag if provided
  if (options?.etag) {
    await kv.put(`${key}:etag`, options.etag, {
      expirationTtl: ttl,
    });
  }

  // Store Last-Modified if provided
  if (options?.lastModified) {
    await kv.put(`${key}:modified`, options.lastModified, {
      expirationTtl: ttl,
    });
  }
}

export async function getCacheMetadata(
  kv: KVNamespace,
  url: string
): Promise<CacheMetadata> {
  const key = await generateCacheKey(url);

  const [etag, lastModified] = await Promise.all([
    kv.get(`${key}:etag`),
    kv.get(`${key}:modified`),
  ]);

  return {
    etag,
    lastModified,
  };
}
