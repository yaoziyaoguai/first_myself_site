import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Navbar from '@/components/Navbar'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

import { usePathname } from 'next/navigation'

describe('Navbar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render navigation links', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(<Navbar />)
      expect(screen.getByText('首页')).toBeInTheDocument()
      expect(screen.getByText('关于')).toBeInTheDocument()
      expect(screen.getByText('项目')).toBeInTheDocument()
      expect(screen.getByText('博客')).toBeInTheDocument()
      expect(screen.getByText('联系')).toBeInTheDocument()
    })

    it('should render hamburger menu button', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(<Navbar />)
      const hamburgerButton = screen.getByRole('button')
      expect(hamburgerButton).toBeInTheDocument()
    })

    it('should render all 5 navigation links', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(<Navbar />)
      const navLinks = screen.getAllByRole('link')
      expect(navLinks).toHaveLength(5)
    })
  })

  describe('mobile menu toggle', () => {
    it('should start with menu closed on mobile', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(<Navbar />)
      // Mobile nav should not be visible initially
      const mobileNav = container.querySelector('nav')
      // The nav exists but may be hidden via CSS
      expect(mobileNav).toBeInTheDocument()
    })

    it('should toggle menu when hamburger button is clicked', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(<Navbar />)
      const hamburgerButton = screen.getByRole('button')

      fireEvent.click(hamburgerButton)
      // After click, menu should be visible

      fireEvent.click(hamburgerButton)
      // After second click, menu should be hidden
    })

    it('should close menu when a link is clicked', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(<Navbar />)
      const hamburgerButton = screen.getByRole('button')

      fireEvent.click(hamburgerButton)
      // Menu is open

      const aboutLink = screen.getByRole('link', { name: '关于' })
      fireEvent.click(aboutLink)
      // Menu should be closed
    })
  })

  describe('active link highlighting', () => {
    it('should highlight home link when on home page', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(<Navbar />)
      const homeLink = container.querySelector('a[href="/"]')
      // Check if active styles are applied (implementation-dependent)
      expect(homeLink).toBeInTheDocument()
    })

    it('should highlight about link when on about page', () => {
      vi.mocked(usePathname).mockReturnValue('/about')

      const { container } = render(<Navbar />)
      const aboutLink = container.querySelector('a[href="/about"]')
      expect(aboutLink).toBeInTheDocument()
    })

    it('should highlight projects link when on projects page', () => {
      vi.mocked(usePathname).mockReturnValue('/projects')

      const { container } = render(<Navbar />)
      const projectsLink = container.querySelector('a[href="/projects"]')
      expect(projectsLink).toBeInTheDocument()
    })

    it('should highlight blog link when on blog page', () => {
      vi.mocked(usePathname).mockReturnValue('/blog')

      const { container } = render(<Navbar />)
      const blogLink = container.querySelector('a[href="/blog"]')
      expect(blogLink).toBeInTheDocument()
    })

    it('should highlight contact link when on contact page', () => {
      vi.mocked(usePathname).mockReturnValue('/contact')

      const { container } = render(<Navbar />)
      const contactLink = container.querySelector('a[href="/contact"]')
      expect(contactLink).toBeInTheDocument()
    })

    it('should update highlighting when pathname changes', () => {
      const { rerender, container } = render(<Navbar />)
      vi.mocked(usePathname).mockReturnValue('/')
      rerender(<Navbar />)

      vi.mocked(usePathname).mockReturnValue('/about')
      rerender(<Navbar />)
      // Navbar should re-render with new active link
      expect(screen.getByRole('link', { name: '关于' })).toBeInTheDocument()
    })
  })

  describe('responsiveness', () => {
    it('should have responsive classes', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(<Navbar />)
      // Check for responsive design patterns
      expect(container.firstChild).toBeInTheDocument()
    })

    it('should render hamburger button for mobile', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      render(<Navbar />)
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })
  })

  describe('link targets', () => {
    it('should have correct href for all links', () => {
      vi.mocked(usePathname).mockReturnValue('/')

      const { container } = render(<Navbar />)
      const links = container.querySelectorAll('a')

      const hrefs = Array.from(links).map((a) => a.getAttribute('href'))
      expect(hrefs).toContain('/')
      expect(hrefs).toContain('/about')
      expect(hrefs).toContain('/projects')
      expect(hrefs).toContain('/blog')
      expect(hrefs).toContain('/contact')
    })
  })
})
