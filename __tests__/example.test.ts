import { describe, it, expect } from 'vitest'

describe('example', () => {
  it('should pass basic math', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle string operations', () => {
    expect('hello'.toUpperCase()).toBe('HELLO')
  })
})
