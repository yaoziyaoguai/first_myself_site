import { describe, it, expect } from 'vitest'
import type { AccessArgs } from 'payload'
import Blog from '@/src/payload/collections/Blog'

describe('Blog Collection - Access Control', () => {
  // Extract access functions from Blog collection config
  const blogAccess = Blog.access!

  type AccessArg = Parameters<NonNullable<typeof blogAccess.read>>[0]

  // Helper to create mock request objects
  const mockRequest = (user?: { id: string; role: string }) => ({
    user,
  })

  describe('read access', () => {
    const readAccess = blogAccess.read!

    it('should return double filter for unauthenticated users (status + visibility)', () => {
      const result = readAccess({ req: mockRequest() } as unknown as AccessArg)
      expect(result).toEqual({
        status: { equals: 'published' },
        visibility: { equals: 'public' },
      })
    })

    it('should return true for admin users', () => {
      const result = readAccess({
        req: mockRequest({ id: '1', role: 'admin' }),
      } as unknown as AccessArg)
      expect(result).toBe(true)
    })

    it('should return true for editor users', () => {
      const result = readAccess({
        req: mockRequest({ id: '2', role: 'editor' }),
      } as unknown as AccessArg)
      expect(result).toBe(true)
    })

    it('should return false for viewer (non-editor/admin) users', () => {
      const result = readAccess({
        req: mockRequest({ id: '3', role: 'viewer' }),
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should return false for unknown roles', () => {
      const result = readAccess({
        req: mockRequest({ id: '4', role: 'unknown' }),
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })
  })

  describe('create access', () => {
    const createAccess = blogAccess.create!

    it('should return false for unauthenticated users', () => {
      const result = createAccess({ req: mockRequest() } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should return true for admin users', () => {
      const result = createAccess({
        req: mockRequest({ id: '1', role: 'admin' }),
      } as unknown as AccessArg)
      expect(result).toBe(true)
    })

    it('should return true for editor users', () => {
      const result = createAccess({
        req: mockRequest({ id: '2', role: 'editor' }),
      } as unknown as AccessArg)
      expect(result).toBe(true)
    })

    it('should return false for viewer users', () => {
      const result = createAccess({
        req: mockRequest({ id: '3', role: 'viewer' }),
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })
  })

  describe('update access', () => {
    const updateAccess = blogAccess.update!

    it('should return false for unauthenticated users', () => {
      const result = updateAccess({ req: mockRequest() } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should return true for admin users', () => {
      const result = updateAccess({
        req: mockRequest({ id: '1', role: 'admin' }),
      } as unknown as AccessArg)
      expect(result).toBe(true)
    })

    it('should return true for editor users', () => {
      const result = updateAccess({
        req: mockRequest({ id: '2', role: 'editor' }),
      } as unknown as AccessArg)
      expect(result).toBe(true)
    })

    it('should return false for viewer users', () => {
      const result = updateAccess({
        req: mockRequest({ id: '3', role: 'viewer' }),
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })
  })

  describe('delete access', () => {
    const deleteAccess = blogAccess.delete!

    it('should return false for unauthenticated users', () => {
      const result = deleteAccess({ req: mockRequest() } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should return true only for admin users', () => {
      const result = deleteAccess({
        req: mockRequest({ id: '1', role: 'admin' }),
      } as unknown as AccessArg)
      expect(result).toBe(true)
    })

    it('should return false for editor users', () => {
      const result = deleteAccess({
        req: mockRequest({ id: '2', role: 'editor' }),
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })

    it('should return false for viewer users', () => {
      const result = deleteAccess({
        req: mockRequest({ id: '3', role: 'viewer' }),
      } as unknown as AccessArg)
      expect(result).toBe(false)
    })
  })
})
