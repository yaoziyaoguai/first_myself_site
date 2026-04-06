import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn - Tailwind class name merge', () => {
  it('should merge simple class names', () => {
    const result = cn('px-2', 'py-1')
    expect(result).toBe('px-2 py-1')
  })

  it('should handle conditional classes', () => {
    const isActive = true
    const result = cn('base', isActive && 'active')
    expect(result).toContain('base')
    expect(result).toContain('active')
  })

  it('should merge Tailwind conflicts (twMerge)', () => {
    // When padding conflicts, rightmost wins
    const result = cn('px-2', 'px-4')
    expect(result).toBe('px-4')
  })

  it('should remove duplicate classes', () => {
    const result = cn('px-2 py-1', 'px-2')
    expect(result).not.toMatch(/px-2.*px-2/)
  })

  it('should handle array input (clsx)', () => {
    const result = cn(['px-2', 'py-1'], 'rounded')
    expect(result).toContain('px-2')
    expect(result).toContain('py-1')
    expect(result).toContain('rounded')
  })

  it('should ignore falsy values', () => {
    const result = cn('px-2', false && 'active', null, undefined, 'py-1')
    expect(result).toBe('px-2 py-1')
  })

  it('should handle object input (clsx)', () => {
    const result = cn({
      'px-2': true,
      'py-1': true,
      'active': false,
    })
    expect(result).toContain('px-2')
    expect(result).toContain('py-1')
    expect(result).not.toContain('active')
  })

  it('should handle empty input', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('should handle width class conflicts', () => {
    // w-full vs w-1/2: rightmost should win
    const result = cn('w-full', 'w-1/2')
    expect(result).toBe('w-1/2')
  })
})
