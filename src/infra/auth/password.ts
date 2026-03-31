import argon2 from 'argon2'
import { tryCatchAsync, type Result } from '@tecnomancy/alchemy'

export const hashPassword = (plain: string): Promise<Result<string, Error>> =>
  tryCatchAsync((p: string) => argon2.hash(p))(plain)

export const verifyPassword = (hash: string, plain: string): Promise<Result<boolean, Error>> =>
  tryCatchAsync((h: string, p: string) => argon2.verify(h, p))(hash, plain)
