import * as jose from 'jose'
import { tryCatchAsync, type Result } from '@tecnomancy/alchemy'

export type TokenPayload = {
  readonly sub: string
  readonly email: string
  readonly role: string
}

const encodeSecret = (secret: string) => new TextEncoder().encode(secret)

export const signToken = (
  payload: TokenPayload,
  secret: string,
  expiresIn: string,
): Promise<Result<string, Error>> =>
  tryCatchAsync(async (p: TokenPayload, s: string, exp: string) =>
    new jose.SignJWT({ ...p })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(encodeSecret(s))
  )(payload, secret, expiresIn)

export const verifyToken = (
  token: string,
  secret: string,
): Promise<Result<TokenPayload, Error>> =>
  tryCatchAsync(async (t: string, s: string) => {
    const { payload } = await jose.jwtVerify(t, encodeSecret(s))
    if (!payload.sub || !payload.email || !payload.role) {
      throw new Error('Invalid token payload: missing required fields')
    }
    return { sub: payload.sub, email: payload.email as string, role: payload.role as string }
  })(token, secret)
