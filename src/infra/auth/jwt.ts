import * as jose from 'jose'
import { tryCatchAsync, type Result } from '@tecnomancy/alchemy'

export type TokenPayload = {
  readonly sub: string
  readonly email: string
  readonly role: string
}

export const signToken = (
  payload: TokenPayload,
  secret: string,
  expiresIn: string
): Promise<Result<string, Error>> =>
  tryCatchAsync(async (p: TokenPayload, s: string, exp: string) =>
    new jose.SignJWT({ ...p })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(new TextEncoder().encode(s))
  )(payload, secret, expiresIn)

export const verifyToken = (
  token: string,
  secret: string
): Promise<Result<TokenPayload, Error>> =>
  tryCatchAsync(async (t: string, s: string) => {
    const { payload } = await jose.jwtVerify(t, new TextEncoder().encode(s))
    return payload as unknown as TokenPayload
  })(token, secret)
