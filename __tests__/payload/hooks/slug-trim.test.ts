import { describe, it, expect } from 'vitest'
import type { CollectionBeforeValidateHook } from 'payload'
import Blog from '@/payload/collections/Blog'
import Posts from '@/payload/collections/Posts'
import Projects from '@/payload/collections/Projects'

type HookArg = Parameters<CollectionBeforeValidateHook>[0]

describe('Slug trim hook - beforeValidate', () => {
  // Extract beforeValidate hook from collections
  const getBlogHook = () => {
    const hooks = Blog.hooks?.beforeValidate
    return hooks && hooks[0]
  }

  const getPostsHook = () => {
    const hooks = Posts.hooks?.beforeValidate
    return hooks && hooks[0]
  }

  const getProjectsHook = () => {
    const hooks = Projects.hooks?.beforeValidate
    return hooks && hooks[0]
  }

  describe('Blog collection slug trim', () => {
    const hook = getBlogHook()

    it('should trim leading and trailing spaces', () => {
      const data = { slug: '  my-blog-post  ' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('my-blog-post')
    })

    it('should not modify slug without spaces', () => {
      const data = { slug: 'my-post' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('my-post')
    })

    it('should preserve internal spaces in slug', () => {
      const data = { slug: 'my long slug title' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('my long slug title')
    })

    it('should handle slug with only spaces', () => {
      const data = { slug: '   ' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('')
    })

    it('should handle undefined slug', () => {
      const data = { slug: undefined }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBeUndefined()
    })

    it('should handle null slug', () => {
      const data = { slug: null }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBeNull()
    })

    it('should handle non-string slug gracefully', () => {
      const data = { slug: 123 }
      const result = hook?.({ data } as unknown as HookArg)
      // Non-string slugs are not modified (safety check in code: typeof data.slug === 'string')
      expect(result?.slug).toBe(123)
    })

    it('should handle empty data object', () => {
      const data: Record<string, unknown> = {}
      const result = hook?.({ data } as unknown as HookArg)
      expect(result).toBeDefined()
    })

    it('should handle nested data object', () => {
      const data = { slug: '  nested-slug  ', title: 'Test' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('nested-slug')
      expect(result?.title).toBe('Test') // Other fields unchanged
    })

    it('should handle multiple spaces and tabs', () => {
      const data = { slug: '\t  my-slug  \t' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('my-slug')
    })

    it('should handle newlines in slug', () => {
      const data = { slug: '  my-slug\n' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('my-slug')
    })
  })

  describe('Posts collection slug trim', () => {
    const hook = getPostsHook()

    it('should trim leading and trailing spaces', () => {
      const data = { slug: '  my-post  ' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('my-post')
    })

    it('should not modify slug without spaces', () => {
      const data = { slug: 'normal-slug' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('normal-slug')
    })

    it('should handle undefined slug', () => {
      const data = { slug: undefined }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBeUndefined()
    })

    it('should preserve internal spaces', () => {
      const data = { slug: 'post title with spaces' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('post title with spaces')
    })
  })

  describe('Projects collection slug trim', () => {
    const hook = getProjectsHook()

    it('should trim leading and trailing spaces', () => {
      const data = { slug: '  my-project  ' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('my-project')
    })

    it('should not modify slug without spaces', () => {
      const data = { slug: 'project-name' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('project-name')
    })

    it('should handle null slug gracefully', () => {
      const data = { slug: null }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBeNull()
    })
  })

  describe('Hook consistency across collections', () => {
    it('Blog, Posts, and Projects should all have beforeValidate hooks', () => {
      expect(getBlogHook()).toBeDefined()
      expect(getPostsHook()).toBeDefined()
      expect(getProjectsHook()).toBeDefined()
    })

    it('All hooks should have the same slug-trim behavior', () => {
      const testSlug = '  test-slug  '
      const blogData = { slug: testSlug }
      const postsData = { slug: testSlug }
      const projectsData = { slug: testSlug }

      const blogResult = getBlogHook()?.({ data: blogData } as unknown as HookArg)
      const postsResult = getPostsHook()?.({ data: postsData } as unknown as HookArg)
      const projectsResult = getProjectsHook()?.({ data: projectsData } as unknown as HookArg)

      expect(blogResult?.slug).toBe('test-slug')
      expect(postsResult?.slug).toBe('test-slug')
      expect(projectsResult?.slug).toBe('test-slug')
    })

    it('should all skip non-string slug values', () => {
      const blogHook = getBlogHook()
      const postsHook = getPostsHook()
      const projectsHook = getProjectsHook()

      const numberSlug = { slug: 123 }
      expect(blogHook?.({ data: numberSlug } as unknown as HookArg).slug).toBe(123)
      expect(postsHook?.({ data: numberSlug } as unknown as HookArg).slug).toBe(123)
      expect(projectsHook?.({ data: numberSlug } as unknown as HookArg).slug).toBe(123)
    })
  })

  describe('Edge cases', () => {
    const hook = getBlogHook()

    it('should handle unicode whitespace', () => {
      const data = { slug: '\u00A0my-slug\u00A0' }
      const result = hook?.({ data } as unknown as HookArg)
      // trim() handles unicode whitespace
      expect(result?.slug).toBe('my-slug')
    })

    it('should handle slug with dots', () => {
      const data = { slug: '  v1.0.0  ' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('v1.0.0')
    })

    it('should handle slug with special characters', () => {
      const data = { slug: '  my-slug_name-v2  ' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('my-slug_name-v2')
    })

    it('should handle slug with numbers', () => {
      const data = { slug: '  post-123  ' }
      const result = hook?.({ data } as unknown as HookArg)
      expect(result?.slug).toBe('post-123')
    })
  })
})
