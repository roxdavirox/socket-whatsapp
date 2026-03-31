import { describe, it, expect } from 'vitest'
import { isOk } from '@tecnomancy/alchemy'
import { hashPassword, verifyPassword } from './password.js'

describe('hashPassword', () => {
  it('hashes a password', async () => {
    const result = await hashPassword('my-secure-password')
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value).toMatch(/^\$argon2/)
  })

  it('produces different hashes for same input', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    if (isOk(a) && isOk(b)) expect(a.value).not.toBe(b.value)
  })
})

describe('verifyPassword', () => {
  it('verifies correct password', async () => {
    const hashed = await hashPassword('test-password')
    if (!isOk(hashed)) throw new Error('hash failed')

    const result = await verifyPassword(hashed.value, 'test-password')
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value).toBe(true)
  })

  it('rejects wrong password', async () => {
    const hashed = await hashPassword('correct-password')
    if (!isOk(hashed)) throw new Error('hash failed')

    const result = await verifyPassword(hashed.value, 'wrong-password')
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value).toBe(false)
  })
})
