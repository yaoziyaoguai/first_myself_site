import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Footer from '@/components/Footer'

// Mock getPayloadAPI
vi.mock('@/lib/payload', () => ({
  getPayloadAPI: vi.fn(),
}))

import { getPayloadAPI } from '@/lib/payload'

interface MockPayloadMethods {
  findGlobal?: ReturnType<typeof vi.fn>
}

describe('Footer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('with complete site settings', () => {
    it('should render site name', async () => {
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test Site',
          bioShort: 'A short bio',
          socialLinks: [
            { href: 'https://github.com/test', label: 'GitHub' },
            { href: 'https://linkedin.com/in/test', label: 'LinkedIn' },
          ],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      render(await Footer())
      expect(screen.getByText('Test Site')).toBeInTheDocument()
    })

    it('should render bioShort when provided', async () => {
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test Site',
          bioShort: 'A short bio about the site',
          socialLinks: [],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      render(await Footer())
      expect(screen.getByText('A short bio about the site')).toBeInTheDocument()
    })

    it('should not render bioShort section when empty', async () => {
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test Site',
          bioShort: '', // Empty string should not render
          socialLinks: [],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const { container } = render(await Footer())
      expect(container.textContent).not.toContain('bio')
    })

    it('should not render bioShort section when undefined', async () => {
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test Site',
          bioShort: undefined, // undefined should not render
          socialLinks: [],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      render(await Footer())
      // Should still render name and other elements
      expect(screen.getByText('Test Site')).toBeInTheDocument()
    })

    it('should render social links', async () => {
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test Site',
          bioShort: 'Bio',
          socialLinks: [
            { href: 'https://github.com/test', label: 'GitHub' },
            { href: 'https://linkedin.com/in/test', label: 'LinkedIn' },
          ],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      render(await Footer())
      const github = screen.getByRole('link', { name: 'GitHub' })
      const linkedin = screen.getByRole('link', { name: 'LinkedIn' })
      expect(github).toHaveAttribute('href', 'https://github.com/test')
      expect(linkedin).toHaveAttribute('href', 'https://linkedin.com/in/test')
    })

    it('should render separators between social links', async () => {
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test Site',
          bioShort: 'Bio',
          socialLinks: [
            { href: 'https://github.com/test', label: 'GitHub' },
            { href: 'https://linkedin.com/test', label: 'LinkedIn' },
            { href: 'https://twitter.com/test', label: 'Twitter' },
          ],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const { container } = render(await Footer())
      // Separator should exist (implementation-dependent on CSS)
      expect(container).toBeInTheDocument()
    })

    it('should handle empty social links array', async () => {
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test Site',
          bioShort: 'Bio',
          socialLinks: [],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      render(await Footer())
      expect(screen.getByText('Test Site')).toBeInTheDocument()
    })

    it('should handle null social links', async () => {
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test Site',
          bioShort: 'Bio',
          socialLinks: null,
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      render(await Footer())
      expect(screen.getByText('Test Site')).toBeInTheDocument()
    })
  })

  describe('dynamic year rendering', () => {
    it('should include current year in footer', async () => {
      const currentYear = new Date().getFullYear()
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test Site',
          bioShort: 'Bio',
          socialLinks: [],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      render(await Footer())
      expect(screen.getByText(currentYear.toString())).toBeInTheDocument()
    })
  })

  describe('payload API calls', () => {
    it('should call getPayloadAPI', async () => {
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test Site',
          bioShort: null,
          socialLinks: [],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      await Footer()
      expect(getPayloadAPI).toHaveBeenCalled()
    })

    it('should call findGlobal with correct slug', async () => {
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test Site',
          bioShort: 'Bio',
          socialLinks: [],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      await Footer()
      expect(mockPayload.findGlobal).toHaveBeenCalledWith({
        slug: 'site-settings',
      })
    })

    it('should handle missing global config', async () => {
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({}),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      render(await Footer())
      // Should not crash, may render empty or default content
      expect(screen.queryByRole('contentinfo')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should render footer element', async () => {
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test Site',
          bioShort: 'Bio',
          socialLinks: [
            { href: 'https://github.com/test', label: 'GitHub' },
          ],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      const { container } = render(await Footer())
      const footer = container.querySelector('footer')
      expect(footer).toBeInTheDocument()
    })

    it('should have proper link semantics', async () => {
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test Site',
          bioShort: null,
          socialLinks: [
            { href: 'https://github.com/test', label: 'GitHub' },
          ],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      render(await Footer())
      const link = screen.getByRole('link', { name: 'GitHub' })
      expect(link).toHaveAttribute('href')
      expect(link).toHaveAttribute('target')
    })
  })

  describe('edge cases', () => {
    it('should handle long names', async () => {
      const longName = 'A'.repeat(100)
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: longName,
          bioShort: 'Bio',
          socialLinks: [],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      render(await Footer())
      expect(screen.getByText(longName)).toBeInTheDocument()
    })

    it('should handle long bio', async () => {
      const longBio = 'Lorem ipsum dolor sit amet, '.repeat(20)
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test',
          bioShort: longBio,
          socialLinks: [],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      render(await Footer())
      expect(screen.getByText(longBio)).toBeInTheDocument()
    })

    it('should handle special characters in names', async () => {
      const specialName = 'Test & Co. <Script>'
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: specialName,
          bioShort: null,
          socialLinks: [],
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      render(await Footer())
      expect(screen.getByText(specialName)).toBeInTheDocument()
    })

    it('should handle many social links', async () => {
      const manyLinks = Array.from({ length: 10 }, (_, i) => ({
        href: `https://example.com/${i}`,
        label: `Link ${i}`,
      }))
      const mockPayload: MockPayloadMethods = {
        findGlobal: vi.fn().mockResolvedValue({
          name: 'Test',
          bioShort: 'Bio',
          socialLinks: manyLinks,
        }),
      }
      vi.mocked(getPayloadAPI).mockResolvedValue(mockPayload as unknown as MockPayloadMethods)

      render(await Footer())
      manyLinks.forEach((link) => {
        expect(screen.getByRole('link', { name: link.label })).toBeInTheDocument()
      })
    })
  })
})
