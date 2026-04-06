import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from '@/app/(main)/api/create-admin/route'

// Mock the payload API
vi.mock('@/lib/payload', () => ({
  getPayloadAPI: vi.fn(),
}))

import { getPayloadAPI } from '@/lib/payload'

interface MockPayloadMethods {
  find?: ReturnType<typeof vi.fn>
  create?: ReturnType<typeof vi.fn>
  update?: ReturnType<typeof vi.fn>
}

describe('GET /api/create-admin', () => {
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('production environment', () => {
    it('should return 403 in production', async () => {
      process.env.NODE_ENV = 'production'
      process.env.ADMIN_SECRET_TOKEN = 'secret'

      const request = new Request('http://localhost:3000/api/create-admin', {
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
      process.env.NODE_ENV = 'development'
      process.env.ADMIN_SECRET_TOKEN = 'my-secret-token'
    })

    it('should return 401 when no authorization header', async () => {
      const request = new Request('http://localhost:3000/api/create-admin')
      const response = await GET(request)
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('Unauthorized')
    })

    it('should return 401 when token is invalid', async () => {
      const request = new Request('http://localhost:3000/api/create-admin', {
        headers: {
          Authorization: 'Bearer wrong-token',
        },
      })
      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('should accept correct bearer token format', async () => {
      process.env.PAYLOAD_INITIAL_ADMIN_EMAIL = 'admin@example.com'
      process.env.PAYLOAD_INITIAL_ADMIN_PASSWORD = 'password123'

      const mockPayload: MockPayloadMethods = {
        find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const request = new Request('http://localhost:3000/api/create-admin', {
        headers: {
          Authorization: 'Bearer my-secret-token',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
    })
  })

  describe('environment variable validation', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development'
      process.env.ADMIN_SECRET_TOKEN = 'test-token'
    })

    it('should return 500 when PAYLOAD_INITIAL_ADMIN_EMAIL is missing', async () => {
      delete process.env.PAYLOAD_INITIAL_ADMIN_EMAIL
      process.env.PAYLOAD_INITIAL_ADMIN_PASSWORD = 'password123'

      const mockPayload: MockPayloadMethods = {
        find: vi.fn(),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const request = new Request('http://localhost:3000/api/create-admin', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toContain('PAYLOAD_INITIAL_ADMIN_EMAIL')
    })

    it('should return 500 when PAYLOAD_INITIAL_ADMIN_PASSWORD is missing', async () => {
      process.env.PAYLOAD_INITIAL_ADMIN_EMAIL = 'admin@example.com'
      delete process.env.PAYLOAD_INITIAL_ADMIN_PASSWORD

      const mockPayload: MockPayloadMethods = {
        find: vi.fn(),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const request = new Request('http://localhost:3000/api/create-admin', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toContain('PAYLOAD_INITIAL_ADMIN_PASSWORD')
    })

    it('should return 500 when both email and password are missing', async () => {
      delete process.env.PAYLOAD_INITIAL_ADMIN_EMAIL
      delete process.env.PAYLOAD_INITIAL_ADMIN_PASSWORD

      const mockPayload: MockPayloadMethods = {
        find: vi.fn(),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const request = new Request('http://localhost:3000/api/create-admin', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(500)
    })
  })

  describe('creating new admin', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development'
      process.env.ADMIN_SECRET_TOKEN = 'test-token'
      process.env.PAYLOAD_INITIAL_ADMIN_EMAIL = 'admin@example.com'
      process.env.PAYLOAD_INITIAL_ADMIN_PASSWORD = 'password123'
    })

    it('should create new admin when user does not exist', async () => {
      const mockPayload: MockPayloadMethods = {
        find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const request = new Request('http://localhost:3000/api/create-admin', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      expect(mockPayload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'users',
          data: expect.objectContaining({
            email: 'admin@example.com',
            password: 'password123',
            role: 'admin',
          }),
        })
      )
    })

    it('should return correct message when creating new admin', async () => {
      const mockPayload: MockPayloadMethods = {
        find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const request = new Request('http://localhost:3000/api/create-admin', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()
      expect(data.message).toContain('管理员已创建')
      expect(data.email).toBe('admin@example.com')
      expect(data.password).toBe('password123')
    })

    it('should use overrideAccess when creating user', async () => {
      const mockPayload: MockPayloadMethods = {
        find: vi.fn().mockResolvedValue({ totalDocs: 0 }),
        create: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const request = new Request('http://localhost:3000/api/create-admin', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      await GET(request)
      expect(mockPayload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          overrideAccess: true,
        })
      )
    })
  })

  describe('updating existing admin', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development'
      process.env.ADMIN_SECRET_TOKEN = 'test-token'
      process.env.PAYLOAD_INITIAL_ADMIN_EMAIL = 'admin@example.com'
      process.env.PAYLOAD_INITIAL_ADMIN_PASSWORD = 'new-password123'
    })

    it('should update password when user already exists', async () => {
      const mockPayload: MockPayloadMethods = {
        find: vi.fn().mockResolvedValue({
          totalDocs: 1,
          docs: [{ id: 'user-1' }],
        }),
        update: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const request = new Request('http://localhost:3000/api/create-admin', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'users',
          id: 'user-1',
          data: {
            password: 'new-password123',
            role: 'admin',
          },
        })
      )
    })

    it('should return correct message when updating admin', async () => {
      const mockPayload: MockPayloadMethods = {
        find: vi.fn().mockResolvedValue({
          totalDocs: 1,
          docs: [{ id: 'user-1' }],
        }),
        update: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const request = new Request('http://localhost:3000/api/create-admin', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      const data = await response.json()
      expect(data.message).toContain('管理员密码已重置')
      expect(data.email).toBe('admin@example.com')
      expect(data.password).toBe('new-password123')
    })

    it('should use overrideAccess when updating user', async () => {
      const mockPayload: MockPayloadMethods = {
        find: vi.fn().mockResolvedValue({
          totalDocs: 1,
          docs: [{ id: 'user-1' }],
        }),
        update: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const request = new Request('http://localhost:3000/api/create-admin', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      await GET(request)
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          overrideAccess: true,
        })
      )
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development'
      process.env.ADMIN_SECRET_TOKEN = 'test-token'
      process.env.PAYLOAD_INITIAL_ADMIN_EMAIL = 'admin@example.com'
      process.env.PAYLOAD_INITIAL_ADMIN_PASSWORD = 'password123'
    })

    it('should return 500 on payload error', async () => {
      const mockPayload = {
        find: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const request = new Request('http://localhost:3000/api/create-admin', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should handle unknown error gracefully', async () => {
      const mockPayload = {
        find: vi.fn().mockRejectedValue('Unknown error string'),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const request = new Request('http://localhost:3000/api/create-admin', {
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
