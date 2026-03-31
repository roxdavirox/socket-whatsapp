import { describe, it, expect, vi } from 'vitest'
import { Ok, Some, None, isOk, isErr } from '@tecnomancy/alchemy'
import { createAuthenticate } from './authenticate.js'
import type { Dependencies } from '../../config/container.js'

const VALID_HASH = '$argon2id$v=19$m=65536,t=3,p=4$mock$hashedvalue'

const mkUser = (overrides = {}) => ({
  id: 'u1',
  email: 'test@test.com',
  name: 'Test',
  role: 'operator',
  passwordHash: VALID_HASH,
  active: true,
  createdAt: new Date(),
  ...overrides,
})

const mkDeps = (user = mkUser()) => ({
  userRepo: {
    getByEmail: vi.fn(async () => Ok(user ? Some(user) : None)),
  },
  env: {
    JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long!',
    JWT_EXPIRES_IN: '1h',
  },
}) as unknown as Dependencies

vi.mock('../../infra/auth/password.js', () => ({
  verifyPassword: vi.fn(async (_hash: string, _plain: string) => Ok(true)),
}))

vi.mock('../../infra/auth/jwt.js', async () => {
  const actual = await vi.importActual('../../infra/auth/jwt.js')
  return actual
})

describe('createAuthenticate', () => {
  it('login succeeds with valid credentials', async () => {
    const auth = createAuthenticate(mkDeps())
    const result = await auth.login({ email: 'test@test.com', password: 'correct' })

    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.token).toMatch(/^ey/)
      expect(result.value.user.email).toBe('test@test.com')
    }
  })

  it('login fails when user not found', async () => {
    const deps = {
      ...mkDeps(),
      userRepo: { getByEmail: vi.fn(async () => Ok(None)) },
    } as unknown as Dependencies
    const auth = createAuthenticate(deps)
    const result = await auth.login({ email: 'nobody@test.com', password: 'x' })

    expect(isErr(result)).toBe(true)
  })

  it('validateToken verifies JWT', async () => {
    const auth = createAuthenticate(mkDeps())
    const loginResult = await auth.login({ email: 'test@test.com', password: 'correct' })
    if (!isOk(loginResult)) throw new Error('login failed')

    const verified = await auth.validateToken(loginResult.value.token)
    expect(isOk(verified)).toBe(true)
    if (isOk(verified)) expect(verified.value.sub).toBe('u1')
  })

  it('validateToken rejects invalid token', async () => {
    const auth = createAuthenticate(mkDeps())
    const result = await auth.validateToken('bad-token')
    expect(isErr(result)).toBe(true)
  })
})
