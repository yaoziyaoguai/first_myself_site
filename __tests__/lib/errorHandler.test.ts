import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AppError, sanitizeErrorForClient, logError } from '@/lib/errorHandler'

describe('AppError', () => {
  it('should create error with default statusCode', () => {
    const error = new AppError('Test error')
    expect(error.message).toBe('Test error')
    expect(error.statusCode).toBe(500)
    expect(error.isOperational).toBe(true)
  })

  it('should create error with custom statusCode', () => {
    const error = new AppError('Not found', 404)
    expect(error.statusCode).toBe(404)
  })

  it('should create error with isOperational=false', () => {
    const error = new AppError('Programmer error', 500, false)
    expect(error.isOperational).toBe(false)
  })

  it('should be instanceof Error', () => {
    const error = new AppError('Test')
    expect(error instanceof Error).toBe(true)
    expect(error instanceof AppError).toBe(true)
  })
})

describe('sanitizeErrorForClient', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('in production', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
    })

    it('should return AppError message and statusCode as-is', () => {
      const error = new AppError('Database connection failed', 503)
      const result = sanitizeErrorForClient(error)
      expect(result.message).toBe('Database connection failed')
      expect(result.statusCode).toBe(503)
    })

    it('should return generic message for non-AppError errors', () => {
      const error = new Error('Actual database error details')
      const result = sanitizeErrorForClient(error)
      expect(result.message).toBe('An error occurred. Please try again later.')
      expect(result.statusCode).toBe(500)
    })

    it('should handle non-Error objects', () => {
      const result = sanitizeErrorForClient('some string error')
      expect(result.message).toBe('An error occurred. Please try again later.')
      expect(result.statusCode).toBe(500)
    })

    it('should handle null/undefined', () => {
      const resultNull = sanitizeErrorForClient(null)
      const resultUndefined = sanitizeErrorForClient(undefined)
      expect(resultNull.message).toBe('An error occurred. Please try again later.')
      expect(resultUndefined.message).toBe('An error occurred. Please try again later.')
    })
  })

  describe('in development', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
    })

    it('should return full error message for Error objects', () => {
      const error = new Error('Detailed error for debugging')
      const result = sanitizeErrorForClient(error)
      expect(result.message).toBe('Detailed error for debugging')
      expect(result.statusCode).toBe(500)
    })

    it('should return AppError message but statusCode always 500 in development', () => {
      // In development, even AppError instances return statusCode 500
      // because they match instanceof Error check first
      const error = new AppError('Operation failed', 400)
      const result = sanitizeErrorForClient(error)
      expect(result.message).toBe('Operation failed')
      expect(result.statusCode).toBe(500) // Always 500 in development mode
    })

    it('should convert non-Error objects to string', () => {
      const result = sanitizeErrorForClient('string error')
      expect(result.message).toBe('string error')
      expect(result.statusCode).toBe(500)
    })
  })
})

describe('logError', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    consoleErrorSpy.mockRestore()
  })

  describe('in production', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
    })

    it('should log structured error with timestamp', () => {
      const error = new Error('Database error')
      logError(error)
      expect(consoleErrorSpy).toHaveBeenCalled()
      const callArg = consoleErrorSpy.mock.calls[0][1]
      expect(callArg).toHaveProperty('message')
      expect(callArg).toHaveProperty('timestamp')
      expect(callArg.message).toBe('Database error')
    })

    it('should include context in structured log', () => {
      const error = new Error('Request failed')
      const context = { userId: '123', endpoint: '/api/users' }
      logError(error, context)
      const callArg = consoleErrorSpy.mock.calls[0][1]
      expect(callArg.context).toEqual(context)
    })

    it('should handle non-Error objects', () => {
      logError('string error', { info: 'test' })
      expect(consoleErrorSpy).toHaveBeenCalled()
      const callArg = consoleErrorSpy.mock.calls[0][1]
      expect(callArg.message).toBe('string error')
    })

    it('should include [ERROR] tag', () => {
      logError(new Error('Test'))
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', expect.any(Object))
    })
  })

  describe('in development', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
    })

    it('should log full error object without structure', () => {
      const error = new Error('Dev error')
      logError(error)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', error, undefined)
    })

    it('should log error and context as second arguments', () => {
      const error = new Error('Dev error')
      const context = { request: 'data' }
      logError(error, context)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', error, context)
    })
  })
})
