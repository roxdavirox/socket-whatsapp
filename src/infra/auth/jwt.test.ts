import { describe, it, expect } from 'vitest'
import { isOk, isErr } from '@tecnomancy/alchemy'
import { signToken, verifyToken, type TokenPayload } from './jwt.js'

const SECRET = 'test-secret-that-is-at-least-32-chars-long!'
const PAYLOAD: TokenPayload = { sub: 'user-1', email: 'test@test.com', role: 'operator' }

describe('signToken', () => {
  it('signs a valid JWT', async () => {
    const result = await signToken(PAYLOAD, SECRET, '1h')
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value).toMatch(/^ey/)
  })
})

describe('verifyToken', () => {
  it('verifies a valid token', async () => {
    const signed = await signToken(PAYLOAD, SECRET, '1h')
    if (!isOk(signed)) throw new Error('sign failed')

    const result = await verifyToken(signed.value, SECRET)
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.sub).toBe('user-1')
      expect(result.value.email).toBe('test@test.com')
      expect(result.value.role).toBe('operator')
    }
  })

  it('rejects invalid token', async () => {
    const result = await verifyToken('invalid.token.here', SECRET)
    expect(isErr(result)).toBe(true)
  })

  it('rejects wrong secret', async () => {
    const signed = await signToken(PAYLOAD, SECRET, '1h')
    if (!isOk(signed)) throw new Error('sign failed')

    const result = await verifyToken(signed.value, 'wrong-secret-that-is-32-chars-plus!!')
    expect(isErr(result)).toBe(true)
  })

  it('rejects expired token', async () => {
    const signed = await signToken(PAYLOAD, SECRET, '0s')
    if (!isOk(signed)) throw new Error('sign failed')

    await new Promise(r => setTimeout(r, 1100))
    const result = await verifyToken(signed.value, SECRET)
    expect(isErr(result)).toBe(true)
  }, 3000)
})
