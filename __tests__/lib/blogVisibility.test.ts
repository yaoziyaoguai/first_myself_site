import { describe, it, expect } from 'vitest'
import {
  buildBlogFrontendWhere,
  canViewPrivateBlog,
} from '@/lib/blogVisibility'

describe('buildBlogFrontendWhere - 前台 Blog 可见性过滤构造器', () => {
  describe('未登录访客', () => {
    it('null viewer：必须同时过滤 status=published 与 visibility=public', () => {
      expect(buildBlogFrontendWhere(null)).toEqual({
        status: { equals: 'published' },
        visibility: { equals: 'public' },
      })
    })

    it('undefined viewer：等价于未登录', () => {
      expect(buildBlogFrontendWhere(undefined)).toEqual({
        status: { equals: 'published' },
        visibility: { equals: 'public' },
      })
    })

    it('canViewPrivateBlog(null) 必须为 false（未登录不能看 private）', () => {
      expect(canViewPrivateBlog(null)).toBe(false)
    })
  })

  describe('普通登录用户 (viewer 角色)', () => {
    it('viewer 角色：仍按公开规则过滤，不能在前台看 private', () => {
      expect(buildBlogFrontendWhere({ role: 'viewer' })).toEqual({
        status: { equals: 'published' },
        visibility: { equals: 'public' },
      })
      expect(canViewPrivateBlog({ role: 'viewer' })).toBe(false)
    })

    it('未知角色：按未授权处理（保守策略）', () => {
      expect(buildBlogFrontendWhere({ role: 'unknown' })).toEqual({
        status: { equals: 'published' },
        visibility: { equals: 'public' },
      })
      expect(canViewPrivateBlog({ role: 'unknown' })).toBe(false)
    })

    it('role 缺失：按未授权处理', () => {
      expect(canViewPrivateBlog({})).toBe(false)
    })
  })

  describe('作者本人 / 管理员 (admin)', () => {
    it('admin：去掉 visibility 过滤，能看到 private 文章', () => {
      const where = buildBlogFrontendWhere({ role: 'admin' })
      expect(where).toEqual({ status: { equals: 'published' } })
      // 关键断言：where 中不含 visibility 过滤，否则 private 会被挡掉
      expect('visibility' in where).toBe(false)
    })

    it('canViewPrivateBlog(admin) 必须为 true', () => {
      expect(canViewPrivateBlog({ role: 'admin' })).toBe(true)
    })

    it('admin 仍然只看 published：草稿不进前台列表', () => {
      const where = buildBlogFrontendWhere({ role: 'admin' })
      expect(where).toMatchObject({ status: { equals: 'published' } })
    })
  })

  describe('编辑 (editor)', () => {
    it('editor：与 admin 对齐，可以看 private', () => {
      expect(buildBlogFrontendWhere({ role: 'editor' })).toEqual({
        status: { equals: 'published' },
      })
      expect(canViewPrivateBlog({ role: 'editor' })).toBe(true)
    })
  })

  describe('与 Blog.access.read 的语义边界', () => {
    it('保证不影响 published+public 文章的可见性（所有角色都能看）', () => {
      // 公开文章必然满足 status=published & visibility=public，
      // 因此对所有角色（含未登录）的 where 都会命中。
      const cases: Array<Parameters<typeof buildBlogFrontendWhere>[0]> = [
        null,
        undefined,
        { role: 'viewer' },
        { role: 'editor' },
        { role: 'admin' },
      ]
      for (const viewer of cases) {
        const where = buildBlogFrontendWhere(viewer)
        // 至少 status 过滤始终是 published，避免任意角色看到草稿
        expect(where.status).toEqual({ equals: 'published' })
      }
    })
  })
})
