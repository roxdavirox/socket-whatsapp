import type { Request, Response, NextFunction } from 'express'
import type { Result } from '@tecnomancy/alchemy'
import { isOk } from '@tecnomancy/alchemy'

export const resultToResponse = <T>(res: Response, result: Result<T, Error>, status = 200) => {
  if (isOk(result)) {
    res.status(status).json({ data: result.value })
  } else {
    const message = result.error.message
    const code = message.includes('not found') ? 404
      : message.includes('Invalid') ? 400
      : message.includes('credentials') ? 401
      : 500
    res.status(code).json({ error: message })
  }
}

export const errorHandler = (_err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: 'Internal server error' })
}
