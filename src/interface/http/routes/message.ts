import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import { resultToResponse } from '../middleware/error-handler.js'
import type { Dependencies } from '../../../config/container.js'

const sendTextSchema = z.object({
  jid: z.string().min(1),
  text: z.string().min(1),
  chatId: z.string().uuid(),
})

export const createMessageRoutes = (deps: Dependencies) => {
  const router = Router()

  router.post('/send', validate(sendTextSchema), async (req, res) => {
    const result = await deps.sendMessage({
      ...req.body,
      ownerId: req.user!.sub,
    })
    resultToResponse(res, result, 201)
  })

  return router
}
