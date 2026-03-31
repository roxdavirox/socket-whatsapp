import type { Request, Response, NextFunction } from 'express'
import { isOk } from '@tecnomancy/alchemy'
import type { Authenticate } from '../../../application/use-cases/authenticate.js'

declare global {
  namespace Express {
    interface Request {
      user?: { sub: string; email: string; role: string }
    }
  }
}

export const createAuthMiddleware = (authenticate: Authenticate) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing token' })
      return
    }

    const token = header.slice(7)
    const result = await authenticate.validateToken(token)

    if (!isOk(result)) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    req.user = result.value
    next()
  }
