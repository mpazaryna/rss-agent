// Rate limit: 100 requests per 60 seconds per client
export const RATE_LIMIT_MAX_REQUESTS = 100;
export const RATE_LIMIT_WINDOW_SECONDS = 60;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

interface RateLimitData {
  count: number;
  windowStart: number;
}

function getRateLimitKey(clientId: string): string {
  return `ratelimit:${clientId}`;
}

export async function checkRateLimit(
  kv: KVNamespace,
  clientId: string
): Promise<RateLimitResult> {
  const key = getRateLimitKey(clientId);
  const stored = await kv.get(key);

  if (!stored) {
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS,
    };
  }

  const data: RateLimitData = JSON.parse(stored);
  const now = Date.now();
  const windowEnd = data.windowStart + RATE_LIMIT_WINDOW_SECONDS * 1000;

  // Window expired - reset
  if (now >= windowEnd) {
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS,
    };
  }

  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - data.count);

  if (remaining === 0) {
    const retryAfter = Math.ceil((windowEnd - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
    };
  }

  return {
    allowed: true,
    remaining,
  };
}

export async function incrementRateLimit(
  kv: KVNamespace,
  clientId: string
): Promise<void> {
  const key = getRateLimitKey(clientId);
  const stored = await kv.get(key);
  const now = Date.now();

  let data: RateLimitData;

  if (stored) {
    data = JSON.parse(stored);
    const windowEnd = data.windowStart + RATE_LIMIT_WINDOW_SECONDS * 1000;

    // Window expired - start new window
    if (now >= windowEnd) {
      data = {
        count: 1,
        windowStart: now,
      };
    } else {
      data.count += 1;
    }
  } else {
    data = {
      count: 1,
      windowStart: now,
    };
  }

  await kv.put(key, JSON.stringify(data), {
    expirationTtl: RATE_LIMIT_WINDOW_SECONDS,
  });
}
