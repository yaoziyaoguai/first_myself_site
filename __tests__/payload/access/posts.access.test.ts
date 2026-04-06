import { describe, it, expect } from 'vitest'
import type { AccessArgs } from 'payload'
import Posts from '@/src/payload/collections/Posts'

describe('Posts Collection - Access Control', () => {
  const postsAccess = Posts.access!

  type AccessArg = Parameters<NonNullable<typeof postsAccess.read>>[0]

  const mockRequest = (user?: { id: string; role: string }) => ({
    user,
  })

  describe('read access - Key difference from Blog: only status filter, no visibility', () => {
    const readAccess = postsAccess.read!

    it('should return only status filter for unauthenticated users (NOT visibility)', () => {
      const result = readAccess({ req: mockRequest() } as unknown as AccessArg)
      expect(result).toEqual({
        status: {
          equals: 'published',
        },
      })
      // Verify that visibility is NOT in the filter
      expect(result).not.toHaveProperty('visibility')
    })

    it('should return single-level filter (only status=published) without visibility field', () => {
      const result = readAccess({ req: mockRequest() } as unknown as AccessArg)
      const filterKeys = Object.keys(result)
      expect(filterKeys).toHaveLength(1)
      expect(filterKeys[0]).toBe('status')
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

    it('should return false for viewer users', () => {
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
    const createAccess = postsAccess.create!

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
    const updateAccess = postsAccess.update!

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
    const deleteAccess = postsAccess.delete!

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
