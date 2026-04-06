import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from '@/app/(main)/api/seed/route'

// Mock the payload API
vi.mock('@/lib/payload', () => ({
  getPayloadAPI: vi.fn(),
}))

import { getPayloadAPI } from '@/lib/payload'

type MockPayload = {
  updateGlobal?: ReturnType<typeof vi.fn>
  find?: ReturnType<typeof vi.fn>
  create?: ReturnType<typeof vi.fn>
}

describe('GET /api/seed', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('production environment', () => {
    it('should return 403 in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('ADMIN_SECRET_TOKEN', 'secret')

      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer secret',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain('Not allowed in production')
    })
  })

  describe('token validation', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('ADMIN_SECRET_TOKEN', 'my-secret-token')
    })

    it('should return 401 when no authorization header', async () => {
      const request = new Request('http://localhost:3000/api/seed')
      const response = await GET(request)
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('Unauthorized')
    })

    it('should return 401 when token is invalid', async () => {
      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer wrong-token',
        },
      })
      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('should return 401 when authorization header format is wrong', async () => {
      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Basic my-secret-token',
        },
      })
      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('should accept correct bearer token', async () => {
      const mockPayload: MockPayload = {
        updateGlobal: vi.fn().mockResolvedValue({}),
        find: vi.fn()
          .mockResolvedValueOnce({ totalDocs: 0 })
          .mockResolvedValueOnce({ totalDocs: 1 }),
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload)

      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer my-secret-token',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
    })
  })

  describe('seed execution', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('ADMIN_SECRET_TOKEN', 'test-token')
    })

    it('should return 200 with success on valid request', async () => {
      const mockPayload: MockPayload = {
        updateGlobal: vi.fn().mockResolvedValue({}),
        find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload)

      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('should call updateGlobal for home settings', async () => {
      const mockPayload: MockPayload = {
        updateGlobal: vi.fn().mockResolvedValue({}),
        find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload)

      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      await GET(request)
      expect(mockPayload.updateGlobal).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'home',
        })
      )
    })

    it('should create projects', async () => {
      const mockPayload: MockPayload = {
        updateGlobal: vi.fn().mockResolvedValue({}),
        find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload)

      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      await GET(request)
      expect(mockPayload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'projects',
        })
      )
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('ADMIN_SECRET_TOKEN', 'test-token')
    })

    it('should return 500 on payload error', async () => {
      const mockPayload = {
        updateGlobal: vi.fn().mockRejectedValue(new Error('Database error')),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as MockPayload)

      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should handle unknown errors gracefully', async () => {
      const mockPayload = {
        updateGlobal: vi.fn().mockRejectedValue('Unknown error'),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as MockPayload)

      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })
})
