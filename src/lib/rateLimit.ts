/**
 * Rate limiting utilities using in-memory storage
 * For small projects. For large scale, consider Redis-based solution.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if a request should be rate limited
 * @param key Unique identifier (IP address, user ID, etc.)
 * @param limit Maximum requests allowed
 * @param windowMs Time window in milliseconds
 * @returns true if rate limit exceeded
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry) {
    // First request from this key
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return false;
  }

  if (now > entry.resetTime) {
    // Window expired, reset
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return false;
  }

  // Within window
  if (entry.count >= limit) {
    return true; // Limit exceeded
  }

  entry.count++;
  return false;
}

/**
 * Get remaining requests in current window
 */
export function getRateLimitRemaining(key: string, limit: number): number {
  const entry = rateLimitStore.get(key);
  if (!entry) return limit;
  if (Date.now() > entry.resetTime) return limit;
  return Math.max(0, limit - entry.count);
}

/**
 * Clear rate limit for a key (for testing or admin reset)
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Common rate limit configurations
 */
export const RATE_LIMITS = {
  // API endpoints: 100 requests per 15 minutes
  API: { limit: 100, windowMs: 15 * 60 * 1000 },

  // Login attempts: 5 per minute to prevent brute force
  LOGIN: { limit: 5, windowMs: 60 * 1000 },

  // Password reset: 3 per hour
  PASSWORD_RESET: { limit: 3, windowMs: 60 * 60 * 1000 },

  // Contact form: 5 per day per IP
  CONTACT_FORM: { limit: 5, windowMs: 24 * 60 * 60 * 1000 },
};

/**
 * Extract client IP from request headers
 * Works with Vercel and typical proxy setups
 */
export function getClientIp(request: Request): string {
  // Vercel sets x-forwarded-for header
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  // Fallback
  return request.headers.get("x-real-ip") || "unknown";
}
