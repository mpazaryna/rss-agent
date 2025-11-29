import type {
  ErrorCode,
  FeedCollection,
  FeedCollectionsDocument,
  CollectionFeed,
} from "./types";

export interface CollectionsParseResult {
  success: boolean;
  data?: FeedCollectionsDocument;
  error?: ErrorCode;
  message?: string;
}

/**
 * Parse feed collections JSON string
 */
export function parseCollections(jsonContent: string): CollectionsParseResult {
  try {
    const data = JSON.parse(jsonContent) as FeedCollectionsDocument;
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: "parse_error",
      message: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

/**
 * Get a collection by its ID
 */
export function getCollectionById(
  collections: FeedCollectionsDocument,
  id: string
): FeedCollection | undefined {
  return collections.collections.find((c) => c.id === id);
}

/**
 * Get all feeds from all collections as a flat list
 */
export function getAllFeeds(
  collections: FeedCollectionsDocument
): CollectionFeed[] {
  return collections.collections.flatMap((c) => c.feeds);
}

/**
 * Filter collections by tag
 */
export function getCollectionsByTag(
  collections: FeedCollectionsDocument,
  tag: string
): FeedCollection[] {
  return collections.collections.filter(
    (c) => c.tags && c.tags.includes(tag)
  );
}

/**
 * Get feeds for a specific collection by ID
 */
export function getFeedsForCollection(
  collections: FeedCollectionsDocument,
  collectionId: string
): CollectionFeed[] {
  const collection = getCollectionById(collections, collectionId);
  return collection ? collection.feeds : [];
}
