import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import { resultToResponse } from '../middleware/error-handler.js'
import type { Dependencies } from '../../../config/container.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const createAuthRoutes = (deps: Dependencies) => {
  const router = Router()

  router.post('/login', validate(loginSchema), async (req, res) => {
    const result = await deps.authenticate.login(req.body)
    resultToResponse(res, result)
  })

  return router
}
