import { describe, it, expect } from 'vitest'
import type { AccessArgs } from 'payload'
import Users from '@/payload/collections/Users'

describe('Users Collection - Access Control', () => {
  const usersAccess = Users.access!

  type AccessArg = Parameters<NonNullable<typeof usersAccess.read>>[0]

  const mockRequest = (user?: { id: string; role: string }) => ({
    user,
  })

  describe('read access', () => {
    const readAccess = usersAccess.read!

    it('should return false for unauthenticated users', () => {
      const result = readAccess({ req: mockRequest() } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should return true for admin users (can see all users)', () => {
      const result = readAccess({
        req: mockRequest({ id: 'admin-1', role: 'admin' }),
      } as unknown as AccessArg)
      expect(result).toBe(true)
    })

    it('should return id filter for viewer/editor (can only see self)', () => {
      const result = readAccess({
        req: mockRequest({ id: 'user-123', role: 'viewer' }),
      } as unknown as AccessArg)
      expect(result).toEqual({
        id: {
          equals: 'user-123',
        },
      })
    })

    it('should return id filter for editor (can only see self, not all users)', () => {
      const result = readAccess({
        req: mockRequest({ id: 'editor-456', role: 'editor' }),
      } as unknown as AccessArg)
      expect(result).toEqual({
        id: {
          equals: 'editor-456',
        },
      })
    })

    it('should isolate users from each other', () => {
      const user1 = mockRequest({ id: 'user-1', role: 'viewer' })
      const user2 = mockRequest({ id: 'user-2', role: 'viewer' })

      const result1 = readAccess({ req: user1 } as unknown as AccessArg)
      const result2 = readAccess({ req: user2 } as unknown as AccessArg)

      expect(result1).toEqual({ id: { equals: 'user-1' } })
      expect(result2).toEqual({ id: { equals: 'user-2' } })
      expect(result1).not.toEqual(result2)
    })
  })

  describe('create access', () => {
    const createAccess = usersAccess.create!

    it('should return false for unauthenticated users', () => {
      const result = createAccess({ req: mockRequest() } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should return false for viewer users', () => {
      const result = createAccess({
        req: mockRequest({ id: '1', role: 'viewer' }),
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should return false for editor users', () => {
      const result = createAccess({
        req: mockRequest({ id: '2', role: 'editor' }),
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should return true only for admin users', () => {
      const result = createAccess({
        req: mockRequest({ id: '3', role: 'admin' }),
      } as unknown as AccessArg)
      expect(result).toBe(true)
    })
  })

  describe('update access', () => {
    const updateAccess = usersAccess.update!

    it('should return false for unauthenticated users', () => {
      const result = updateAccess({
        req: mockRequest(),
        data: {},
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should return true for admin users (unrestricted)', () => {
      const result = updateAccess({
        req: mockRequest({ id: 'admin-1', role: 'admin' }),
        data: { role: 'viewer' },
      } as unknown as AccessArg)
      expect(result).toBe(true)
    })

    it('should allow viewers to update their own data without role change', () => {
      const result = updateAccess({
        req: mockRequest({ id: 'user-1', role: 'viewer' }),
        data: { name: 'New Name' },
      } as unknown as AccessArg)
      expect(result).toEqual({
        id: {
          equals: 'user-1',
        },
      })
    })

    it('should prevent viewers from changing their own role (prevent privilege escalation)', () => {
      const result = updateAccess({
        req: mockRequest({ id: 'user-1', role: 'viewer' }),
        data: { role: 'admin' },
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should prevent viewers from changing role to editor', () => {
      const result = updateAccess({
        req: mockRequest({ id: 'user-2', role: 'viewer' }),
        data: { role: 'editor' },
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should allow updating data without changing role', () => {
      const result = updateAccess({
        req: mockRequest({ id: 'user-3', role: 'viewer' }),
        data: { email: 'newemail@example.com' },
      } as unknown as AccessArg)
      expect(result).toEqual({
        id: {
          equals: 'user-3',
        },
      })
    })

    it('should allow role update only if new role equals current role (idempotent)', () => {
      const result = updateAccess({
        req: mockRequest({ id: 'user-4', role: 'editor' }),
        data: { role: 'editor' },
      } as unknown as AccessArg)
      expect(result).toEqual({
        id: {
          equals: 'user-4',
        },
      })
    })

    it('should prevent editors from changing their own role', () => {
      const result = updateAccess({
        req: mockRequest({ id: 'user-5', role: 'editor' }),
        data: { role: 'admin' },
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should prevent editors from downgrading to viewer', () => {
      const result = updateAccess({
        req: mockRequest({ id: 'user-6', role: 'editor' }),
        data: { role: 'viewer' },
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should restrict non-admin users to updating only their own profile', () => {
      const result = updateAccess({
        req: mockRequest({ id: 'user-7', role: 'viewer' }),
        data: { email: 'other@example.com' },
      } as unknown as AccessArg)
      // Should only allow update on their own id
      expect(result).toEqual({
        id: {
          equals: 'user-7',
        },
      })
    })

    it('should handle null/undefined role in data gracefully', () => {
      const result = updateAccess({
        req: mockRequest({ id: 'user-8', role: 'viewer' }),
        data: { name: 'New Name' },
      } as unknown as AccessArg)
      expect(result).toEqual({
        id: {
          equals: 'user-8',
        },
      })
    })

    it('should prevent role elevation from viewer to admin', () => {
      const result = updateAccess({
        req: mockRequest({ id: 'user-9', role: 'viewer' }),
        data: { role: 'admin' },
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })
  })

  describe('delete access', () => {
    const deleteAccess = usersAccess.delete!

    it('should return false for unauthenticated users', () => {
      const result = deleteAccess({ req: mockRequest() } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should return false for viewer users', () => {
      const result = deleteAccess({
        req: mockRequest({ id: '1', role: 'viewer' }),
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should return false for editor users', () => {
      const result = deleteAccess({
        req: mockRequest({ id: '2', role: 'editor' }),
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should return true only for admin users', () => {
      const result = deleteAccess({
        req: mockRequest({ id: '3', role: 'admin' }),
      } as unknown as AccessArg)
      expect(result).toBe(true)
    })
  })
})
