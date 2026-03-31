import { isOk, isSome, Err, Ok, type Result } from '@tecnomancy/alchemy'
import { signToken, verifyToken, type TokenPayload } from '../../infra/auth/jwt.js'
import { verifyPassword } from '../../infra/auth/password.js'
import type { Dependencies } from '../../config/container.js'

type LoginInput = {
  readonly email: string
  readonly password: string
}

type LoginResult = {
  readonly token: string
  readonly user: { id: string; email: string; name: string; role: string }
}

export const createAuthenticate = (deps: Dependencies) => ({
  login: async (input: LoginInput): Promise<Result<LoginResult, Error>> => {
    const userResult = await deps.userRepo.getByEmail(input.email)
    if (!isOk(userResult)) return Err(userResult.error)
    if (!isSome(userResult.value)) return Err(new Error('Invalid credentials'))

    const user = userResult.value.value
    const valid = await verifyPassword(user.passwordHash, input.password)
    if (!isOk(valid) || !valid.value) return Err(new Error('Invalid credentials'))

    const token = await signToken(
      { sub: user.id, email: user.email, role: user.role },
      deps.env.JWT_SECRET,
      deps.env.JWT_EXPIRES_IN,
    )
    if (!isOk(token)) return Err(token.error)

    return Ok({
      token: token.value,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
  },

  validateToken: (token: string): Promise<Result<TokenPayload, Error>> =>
    verifyToken(token, deps.env.JWT_SECRET),
})

export type Authenticate = ReturnType<typeof createAuthenticate>
