import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isRateLimited, getRateLimitRemaining, clearRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit'

describe('Rate Limiting', () => {
  const testKey = 'test-key'
  const limit = 3
  const windowMs = 1000

  beforeEach(() => {
    // Clear all rate limit entries before each test
    clearRateLimit(testKey)
  })

  describe('isRateLimited', () => {
    it('should return false on first request (not limited)', () => {
      const result = isRateLimited(testKey, limit, windowMs)
      expect(result).toBe(false)
    })

    it('should return false for requests within limit', () => {
      isRateLimited(testKey, limit, windowMs) // 1st
      const result = isRateLimited(testKey, limit, windowMs) // 2nd
      expect(result).toBe(false)
    })

    it('should return false when count equals limit', () => {
      isRateLimited(testKey, limit, windowMs) // 1st
      isRateLimited(testKey, limit, windowMs) // 2nd
      const result = isRateLimited(testKey, limit, windowMs) // 3rd (at limit)
      expect(result).toBe(false)
    })

    it('should return true when limit is exceeded', () => {
      isRateLimited(testKey, limit, windowMs) // 1st
      isRateLimited(testKey, limit, windowMs) // 2nd
      isRateLimited(testKey, limit, windowMs) // 3rd
      const result = isRateLimited(testKey, limit, windowMs) // 4th (over limit)
      expect(result).toBe(true)
    })

    it('should continue returning true while in window and over limit', () => {
      for (let i = 0; i < limit; i++) {
        isRateLimited(testKey, limit, windowMs)
      }
      // Now over limit
      expect(isRateLimited(testKey, limit, windowMs)).toBe(true)
      expect(isRateLimited(testKey, limit, windowMs)).toBe(true)
      expect(isRateLimited(testKey, limit, windowMs)).toBe(true)
    })

    it('should reset when window expires', () => {
      const now = Date.now()
      vi.useFakeTimers()
      vi.setSystemTime(now)

      // Fill up the limit
      for (let i = 0; i < limit; i++) {
        isRateLimited(testKey, limit, windowMs)
      }
      expect(isRateLimited(testKey, limit, windowMs)).toBe(true)

      // Move past window expiration
      vi.setSystemTime(now + windowMs + 1)
      const result = isRateLimited(testKey, limit, windowMs)
      expect(result).toBe(false) // Should reset

      vi.useRealTimers()
    })

    it('should track different keys independently', () => {
      const key1 = 'key-1'
      const key2 = 'key-2'
      clearRateLimit(key1)
      clearRateLimit(key2)

      // Fill limit for key1
      for (let i = 0; i < limit; i++) {
        isRateLimited(key1, limit, windowMs)
      }
      expect(isRateLimited(key1, limit, windowMs)).toBe(true)

      // key2 should not be affected
      expect(isRateLimited(key2, limit, windowMs)).toBe(false)
      expect(isRateLimited(key2, limit, windowMs)).toBe(false)

      clearRateLimit(key1)
      clearRateLimit(key2)
    })

    it('should support zero limit (first request allowed, rest blocked)', () => {
      // Even with limit=0, first request returns false (creates entry)
      // Only subsequent requests within window are blocked
      const first = isRateLimited(testKey, 0, windowMs)
      expect(first).toBe(false) // First request always allowed
      const second = isRateLimited(testKey, 0, windowMs)
      expect(second).toBe(true) // Second request blocked
    })

    it('should support very large limit', () => {
      const largeLimit = 1000000
      const requests = 100
      for (let i = 0; i < requests; i++) {
        expect(isRateLimited(testKey, largeLimit, windowMs)).toBe(false)
      }
    })
  })

  describe('getRateLimitRemaining', () => {
    it('should return full limit for new key', () => {
      const remaining = getRateLimitRemaining(testKey, limit)
      expect(remaining).toBe(limit)
    })

    it('should return remaining count after requests', () => {
      isRateLimited(testKey, limit, windowMs)
      const remaining = getRateLimitRemaining(testKey, limit)
      expect(remaining).toBe(limit - 1)
    })

    it('should return 0 when limit reached', () => {
      for (let i = 0; i < limit; i++) {
        isRateLimited(testKey, limit, windowMs)
      }
      const remaining = getRateLimitRemaining(testKey, limit)
      expect(remaining).toBe(0)
    })

    it('should return 0 when over limit (not negative)', () => {
      for (let i = 0; i < limit + 5; i++) {
        isRateLimited(testKey, limit, windowMs)
      }
      const remaining = getRateLimitRemaining(testKey, limit)
      expect(remaining).toBe(0)
    })

    it('should reset remaining after window expires', () => {
      const now = Date.now()
      vi.useFakeTimers()
      vi.setSystemTime(now)

      for (let i = 0; i < limit; i++) {
        isRateLimited(testKey, limit, windowMs)
      }
      expect(getRateLimitRemaining(testKey, limit)).toBe(0)

      vi.setSystemTime(now + windowMs + 1)
      const remaining = getRateLimitRemaining(testKey, limit)
      expect(remaining).toBe(limit)

      vi.useRealTimers()
    })

    it('should track different keys independently', () => {
      const key1 = 'key-1'
      const key2 = 'key-2'
      clearRateLimit(key1)
      clearRateLimit(key2)

      isRateLimited(key1, limit, windowMs)
      isRateLimited(key1, limit, windowMs)
      expect(getRateLimitRemaining(key1, limit)).toBe(limit - 2)
      expect(getRateLimitRemaining(key2, limit)).toBe(limit)

      clearRateLimit(key1)
      clearRateLimit(key2)
    })
  })

  describe('clearRateLimit', () => {
    it('should clear rate limit for a key', () => {
      isRateLimited(testKey, limit, windowMs)
      isRateLimited(testKey, limit, windowMs)
      expect(getRateLimitRemaining(testKey, limit)).toBe(limit - 2)

      clearRateLimit(testKey)
      expect(getRateLimitRemaining(testKey, limit)).toBe(limit)
    })

    it('should not affect other keys', () => {
      const key1 = 'key-1'
      const key2 = 'key-2'
      clearRateLimit(key1)
      clearRateLimit(key2)

      isRateLimited(key1, limit, windowMs)
      isRateLimited(key2, limit, windowMs)
      clearRateLimit(key1)

      expect(getRateLimitRemaining(key1, limit)).toBe(limit)
      expect(getRateLimitRemaining(key2, limit)).toBe(limit - 1)

      clearRateLimit(key2)
    })

    it('should be idempotent (safe to call multiple times)', () => {
      isRateLimited(testKey, limit, windowMs)
      clearRateLimit(testKey)
      clearRateLimit(testKey) // Should not throw
      expect(getRateLimitRemaining(testKey, limit)).toBe(limit)
    })
  })

  describe('RATE_LIMITS constants', () => {
    it('should define API rate limit', () => {
      expect(RATE_LIMITS.API).toBeDefined()
      expect(RATE_LIMITS.API.limit).toBe(100)
      expect(RATE_LIMITS.API.windowMs).toBe(15 * 60 * 1000)
    })

    it('should define LOGIN rate limit', () => {
      expect(RATE_LIMITS.LOGIN).toBeDefined()
      expect(RATE_LIMITS.LOGIN.limit).toBe(5)
      expect(RATE_LIMITS.LOGIN.windowMs).toBe(60 * 1000)
    })

    it('should define PASSWORD_RESET rate limit', () => {
      expect(RATE_LIMITS.PASSWORD_RESET).toBeDefined()
      expect(RATE_LIMITS.PASSWORD_RESET.limit).toBe(3)
      expect(RATE_LIMITS.PASSWORD_RESET.windowMs).toBe(60 * 60 * 1000)
    })

    it('should define CONTACT_FORM rate limit', () => {
      expect(RATE_LIMITS.CONTACT_FORM).toBeDefined()
      expect(RATE_LIMITS.CONTACT_FORM.limit).toBe(5)
      expect(RATE_LIMITS.CONTACT_FORM.windowMs).toBe(24 * 60 * 60 * 1000)
    })
  })
})

describe('getClientIp', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const request = new Request('http://example.com', {
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      },
    })
    expect(getClientIp(request)).toBe('192.168.1.1')
  })

  it('should trim whitespace from x-forwarded-for', () => {
    const request = new Request('http://example.com', {
      headers: {
        'x-forwarded-for': '  192.168.1.1  , 10.0.0.1',
      },
    })
    expect(getClientIp(request)).toBe('192.168.1.1')
  })

  it('should use x-real-ip as fallback', () => {
    const request = new Request('http://example.com', {
      headers: {
        'x-real-ip': '172.16.0.1',
      },
    })
    expect(getClientIp(request)).toBe('172.16.0.1')
  })

  it('should prioritize x-forwarded-for over x-real-ip', () => {
    const request = new Request('http://example.com', {
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'x-real-ip': '172.16.0.1',
      },
    })
    expect(getClientIp(request)).toBe('192.168.1.1')
  })

  it('should return unknown when no headers present', () => {
    const request = new Request('http://example.com', {
      headers: {},
    })
    expect(getClientIp(request)).toBe('unknown')
  })

  it('should handle multiple IPs in x-forwarded-for (Vercel/proxy format)', () => {
    const request = new Request('http://example.com', {
      headers: {
        'x-forwarded-for': '203.0.113.1, 203.0.113.2, 203.0.113.3',
      },
    })
    expect(getClientIp(request)).toBe('203.0.113.1')
  })

  it('should handle single IP in x-forwarded-for', () => {
    const request = new Request('http://example.com', {
      headers: {
        'x-forwarded-for': '203.0.113.1',
      },
    })
    expect(getClientIp(request)).toBe('203.0.113.1')
  })
})
