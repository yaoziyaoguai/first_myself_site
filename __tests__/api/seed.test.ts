import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from '@/app/(main)/api/seed/route'

// Mock the payload API
vi.mock('@/lib/payload', () => ({
  getPayloadAPI: vi.fn(),
}))

import { getPayloadAPI } from '@/lib/payload'

interface MockPayloadMethods {
  updateGlobal?: ReturnType<typeof vi.fn>
  find?: ReturnType<typeof vi.fn>
  create?: ReturnType<typeof vi.fn>
}

describe('GET /api/seed', () => {
  # env will be stubbed

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development")
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('production environment', () => {
    it('should return 403 in production', async () => {
      vi.stubEnv("NODE_ENV", 'production'
      vi.stubEnv("ADMIN_SECRET_TOKEN", 'secret'

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
      vi.stubEnv("NODE_ENV", 'development'
      vi.stubEnv("ADMIN_SECRET_TOKEN", 'my-secret-token'
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
      const mockPayload: MockPayloadMethods = {
        updateGlobal: vi.fn().mockResolvedValue({}),
        find: vi.fn()
          .mockResolvedValueOnce({ totalDocs: 0 }) // projects check
          .mockResolvedValueOnce({ totalDocs: 1 }), // users check
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as any)

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
      vi.stubEnv("NODE_ENV", 'development'
      vi.stubEnv("ADMIN_SECRET_TOKEN", 'test-token'
    })

    it('should return 200 with success on valid request', async () => {
      const mockPayload: MockPayloadMethods = {
        updateGlobal: vi.fn().mockResolvedValue({}),
        find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as any)

      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.results).toBeDefined()
      expect(Array.isArray(data.results)).toBe(true)
    })

    it('should call updateGlobal for each global', async () => {
      const mockPayload: MockPayloadMethods = {
        updateGlobal: vi.fn().mockResolvedValue({}),
        find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as any)

      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      await GET(request)
      expect(mockPayload.updateGlobal).toHaveBeenCalledTimes(4)
    })

    it('should call find to check existing projects', async () => {
      const mockPayload: MockPayloadMethods = {
        updateGlobal: vi.fn().mockResolvedValue({}),
        find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as any)

      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      await GET(request)
      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'projects',
        })
      )
    })

    it('should skip project creation if projects exist', async () => {
      const mockPayload: MockPayloadMethods = {
        updateGlobal: vi.fn().mockResolvedValue({}),
        find: vi.fn().mockResolvedValue({ totalDocs: 1 }),
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as any)

      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()
      expect(mockPayload.create).not.toHaveBeenCalled()
      expect(data.results).toContainEqual(expect.stringContaining('already exist'))
    })

    it('should create projects if none exist', async () => {
      const mockPayload: MockPayloadMethods = {
        updateGlobal: vi.fn().mockResolvedValue({}),
        find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as any)

      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      expect(mockPayload.create).toHaveBeenCalled()
      const data = await response.json()
      expect(data.results).toContainEqual(expect.stringContaining('projects seeded'))
    })

    it('should return 500 on error', async () => {
      const mockPayload: MockPayloadMethods = {
        updateGlobal: vi.fn().mockRejectedValue(new Error('Database error')),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as any)

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

    it('should include admin user check in results', async () => {
      const mockPayload: MockPayloadMethods = {
        updateGlobal: vi.fn().mockResolvedValue({}),
        find: vi.fn()
          .mockResolvedValueOnce({ totalDocs: 0 }) // projects
          .mockResolvedValueOnce({ totalDocs: 0 }), // users
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as any)

      const request = new Request('http://localhost:3000/api/seed', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()
      expect(data.results).toContainEqual(expect.stringContaining('create-admin'))
    })
  })
})
