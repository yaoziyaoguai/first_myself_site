import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { validateRequiredEnvVars, validateDevEnvVars, getEnv, getOptionalEnv } from '@/lib/env'

describe('validateRequiredEnvVars', () => {
  beforeEach(() => {
    vi.stubEnv('PAYLOAD_SECRET', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should not throw when PAYLOAD_SECRET is set', () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret')
    expect(() => validateRequiredEnvVars()).not.toThrow()
  })

  it('should throw when PAYLOAD_SECRET is missing', () => {
    vi.stubEnv('PAYLOAD_SECRET', '')
    expect(() => validateRequiredEnvVars()).toThrow('Missing required environment variables: PAYLOAD_SECRET')
  })

  it('should throw with correct error message format', () => {
    vi.stubEnv('PAYLOAD_SECRET', '')
    expect(() => validateRequiredEnvVars()).toThrow(/Missing required environment variables/)
  })
})

describe('validateDevEnvVars', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('NODE_ENV', 'development')
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  it('should not warn when ADMIN_SECRET_TOKEN is set in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ADMIN_SECRET_TOKEN', 'test-token')
    validateDevEnvVars()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('should warn when ADMIN_SECRET_TOKEN is missing in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ADMIN_SECRET_TOKEN', '')
    validateDevEnvVars()
    expect(consoleWarnSpy).toHaveBeenCalled()
    expect(consoleWarnSpy.mock.calls[0][0]).toContain('ADMIN_SECRET_TOKEN')
  })

  it('should not warn in production even if ADMIN_SECRET_TOKEN is missing', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_SECRET_TOKEN', '')
    validateDevEnvVars()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('should not warn in test environment with token', () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('ADMIN_SECRET_TOKEN', 'test-token')
    validateDevEnvVars()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('should warn with helpful message about development endpoints', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ADMIN_SECRET_TOKEN', '')
    validateDevEnvVars()
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Development endpoints')
    )
  })
})

describe('getEnv', () => {
  beforeEach(() => {
    vi.stubEnv('TEST_VAR', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should return environment variable value when set', () => {
    vi.stubEnv('TEST_VAR', 'test-value')
    expect(getEnv('TEST_VAR')).toBe('test-value')
  })

  it('should throw error when variable is not set and no default provided', () => {
    vi.stubEnv('NONEXISTENT_VAR', '')
    expect(() => getEnv('NONEXISTENT_VAR')).toThrow('Environment variable NONEXISTENT_VAR is required but not set')
  })

  it('should return default value when variable is not set but default provided', () => {
    vi.stubEnv('TEST_DEFAULT_VAR', '')
    expect(getEnv('TEST_DEFAULT_VAR', 'default-value')).toBe('default-value')
  })

  it('should return actual value over default when both present', () => {
    vi.stubEnv('TEST_VAR', 'actual-value')
    expect(getEnv('TEST_VAR', 'default-value')).toBe('actual-value')
  })

  it('should handle empty string as valid value', () => {
    vi.stubEnv('EMPTY_VAR', '')
    expect(() => getEnv('EMPTY_VAR')).toThrow() // Empty string is falsy
  })

  it('should return default when variable is empty string', () => {
    vi.stubEnv('EMPTY_VAR', '')
    expect(getEnv('EMPTY_VAR', 'default')).toBe('default')
  })
})

describe('getOptionalEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should return environment variable value when set', () => {
    vi.stubEnv('OPTIONAL_VAR', 'optional-value')
    expect(getOptionalEnv('OPTIONAL_VAR')).toBe('optional-value')
  })

  it('should return undefined when variable is not set and no default', () => {
    vi.stubEnv('OPTIONAL_VAR', '')
    expect(getOptionalEnv('OPTIONAL_VAR')).toBeUndefined()
  })

  it('should return default when variable is not set', () => {
    vi.stubEnv('OPTIONAL_VAR', '')
    expect(getOptionalEnv('OPTIONAL_VAR', 'optional-default')).toBe('optional-default')
  })

  it('should return actual value over default when both present', () => {
    vi.stubEnv('OPTIONAL_VAR', 'actual')
    expect(getOptionalEnv('OPTIONAL_VAR', 'default')).toBe('actual')
  })

  it('should return default when variable is empty string', () => {
    vi.stubEnv('EMPTY_OPTIONAL', '')
    expect(getOptionalEnv('EMPTY_OPTIONAL', 'default')).toBe('default')
  })

  it('should return undefined for empty string without default', () => {
    vi.stubEnv('EMPTY_OPTIONAL', '')
    expect(getOptionalEnv('EMPTY_OPTIONAL')).toBeUndefined()
  })
})
