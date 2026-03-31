import type { Request, Response, NextFunction } from 'express'
import { isOk } from '@tecnomancy/alchemy'
import type { Result } from '@tecnomancy/alchemy'

const ERROR_CODES: readonly [RegExp, number][] = [
  [/not found/i, 404],
  [/credentials/i, 401],
  [/invalid/i, 400],
]

const resolveErrorCode = (message: string) =>
  ERROR_CODES.find(([pattern]) => pattern.test(message))?.[1] ?? 500

export const resultToResponse = <T>(res: Response, result: Result<T, Error>, status = 200) =>
  isOk(result)
    ? res.status(status).json({ data: result.value })
    : res.status(resolveErrorCode(result.error.message)).json({ error: result.error.message })

export const errorHandler = (_err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: 'Internal server error' })
}
