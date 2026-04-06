import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { validateRequiredEnvVars, validateDevEnvVars, getEnv, getOptionalEnv } from '@/lib/env'

describe('validateRequiredEnvVars', () => {
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should not throw when PAYLOAD_SECRET is set', () => {
    process.env.PAYLOAD_SECRET = 'test-secret'
    expect(() => validateRequiredEnvVars()).not.toThrow()
  })

  it('should throw when PAYLOAD_SECRET is missing', () => {
    delete process.env.PAYLOAD_SECRET
    expect(() => validateRequiredEnvVars()).toThrow('Missing required environment variables: PAYLOAD_SECRET')
  })

  it('should throw with correct error message format', () => {
    delete process.env.PAYLOAD_SECRET
    expect(() => validateRequiredEnvVars()).toThrow(/Missing required environment variables/)
  })
})

describe('validateDevEnvVars', () => {
  let originalEnv: Record<string, string | undefined>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalEnv = { ...process.env }
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = originalEnv
    consoleWarnSpy.mockRestore()
  })

  it('should not warn when ADMIN_SECRET_TOKEN is set in development', () => {
    process.env.NODE_ENV = 'development'
    process.env.ADMIN_SECRET_TOKEN = 'test-token'
    validateDevEnvVars()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('should warn when ADMIN_SECRET_TOKEN is missing in development', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.ADMIN_SECRET_TOKEN
    validateDevEnvVars()
    expect(consoleWarnSpy).toHaveBeenCalled()
    expect(consoleWarnSpy.mock.calls[0][0]).toContain('ADMIN_SECRET_TOKEN')
  })

  it('should not warn in production even if ADMIN_SECRET_TOKEN is missing', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.ADMIN_SECRET_TOKEN
    validateDevEnvVars()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('should not warn in test environment with token', () => {
    process.env.NODE_ENV = 'test'
    process.env.ADMIN_SECRET_TOKEN = 'test-token'
    validateDevEnvVars()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('should warn with helpful message about development endpoints', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.ADMIN_SECRET_TOKEN
    validateDevEnvVars()
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Development endpoints')
    )
  })
})

describe('getEnv', () => {
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return environment variable value when set', () => {
    process.env.TEST_VAR = 'test-value'
    expect(getEnv('TEST_VAR')).toBe('test-value')
  })

  it('should throw error when variable is not set and no default provided', () => {
    delete process.env.NONEXISTENT_VAR
    expect(() => getEnv('NONEXISTENT_VAR')).toThrow('Environment variable NONEXISTENT_VAR is required but not set')
  })

  it('should return default value when variable is not set but default provided', () => {
    delete process.env.TEST_DEFAULT_VAR
    expect(getEnv('TEST_DEFAULT_VAR', 'default-value')).toBe('default-value')
  })

  it('should return actual value over default when both present', () => {
    process.env.TEST_VAR = 'actual-value'
    expect(getEnv('TEST_VAR', 'default-value')).toBe('actual-value')
  })

  it('should handle empty string as valid value', () => {
    process.env.EMPTY_VAR = ''
    expect(() => getEnv('EMPTY_VAR')).toThrow() // Empty string is falsy
  })

  it('should return default when variable is empty string', () => {
    process.env.EMPTY_VAR = ''
    expect(getEnv('EMPTY_VAR', 'default')).toBe('default')
  })
})

describe('getOptionalEnv', () => {
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return environment variable value when set', () => {
    process.env.OPTIONAL_VAR = 'optional-value'
    expect(getOptionalEnv('OPTIONAL_VAR')).toBe('optional-value')
  })

  it('should return undefined when variable is not set and no default', () => {
    delete process.env.OPTIONAL_VAR
    expect(getOptionalEnv('OPTIONAL_VAR')).toBeUndefined()
  })

  it('should return default when variable is not set', () => {
    delete process.env.OPTIONAL_VAR
    expect(getOptionalEnv('OPTIONAL_VAR', 'optional-default')).toBe('optional-default')
  })

  it('should return actual value over default when both present', () => {
    process.env.OPTIONAL_VAR = 'actual'
    expect(getOptionalEnv('OPTIONAL_VAR', 'default')).toBe('actual')
  })

  it('should return default when variable is empty string', () => {
    process.env.EMPTY_OPTIONAL = ''
    expect(getOptionalEnv('EMPTY_OPTIONAL', 'default')).toBe('default')
  })

  it('should return undefined for empty string without default', () => {
    process.env.EMPTY_OPTIONAL = ''
    expect(getOptionalEnv('EMPTY_OPTIONAL')).toBeUndefined()
  })
})
