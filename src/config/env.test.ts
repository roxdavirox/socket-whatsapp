import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isOk, isErr } from '@tecnomancy/alchemy'
import { loadEnv } from './env.js'

const VALID_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
  JWT_SECRET: 'a-very-long-secret-that-is-at-least-32-chars',
}

describe('loadEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, ...VALID_ENV }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('loads valid env with defaults', () => {
    const result = loadEnv()
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.PORT).toBe(3000)
      expect(['development', 'test']).toContain(result.value.NODE_ENV)
      expect(result.value.AI_PROVIDER).toBe('none')
      expect(result.value.LOG_LEVEL).toBe('info')
      expect(result.value.SYMPHONY_ENABLED).toBe(false)
    }
  })

  it('fails without DATABASE_URL', () => {
    delete process.env.DATABASE_URL
    expect(isErr(loadEnv())).toBe(true)
  })

  it('fails without JWT_SECRET', () => {
    delete process.env.JWT_SECRET
    expect(isErr(loadEnv())).toBe(true)
  })

  it('fails with short JWT_SECRET', () => {
    process.env.JWT_SECRET = 'short'
    expect(isErr(loadEnv())).toBe(true)
  })

  it('coerces PORT to number', () => {
    process.env.PORT = '8080'
    const result = loadEnv()
    if (isOk(result)) expect(result.value.PORT).toBe(8080)
  })

  it('coerces SYMPHONY_ENABLED to boolean', () => {
    process.env.SYMPHONY_ENABLED = 'true'
    const result = loadEnv()
    if (isOk(result)) expect(result.value.SYMPHONY_ENABLED).toBe(true)
  })
})
