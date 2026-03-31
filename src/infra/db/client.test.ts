import { describe, it, expect } from 'vitest'
import { isOk, isErr } from '@tecnomancy/alchemy'
import { createDbClient } from './client.js'

describe('createDbClient', () => {
  it('creates client with valid URL', () => {
    const result = createDbClient('postgresql://user:pass@localhost:5432/test')
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.db).toBeDefined()
      expect(result.value.sql).toBeDefined()
    }
  })

  it('creates client even with empty URL (postgres is lazy)', () => {
    const result = createDbClient('postgresql://invalid:5432/x')
    expect(isOk(result)).toBe(true)
  })
})
