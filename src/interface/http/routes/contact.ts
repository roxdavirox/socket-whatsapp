import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import { resultToResponse } from '../middleware/error-handler.js'
import type { Dependencies } from '../../../config/container.js'

const transferSchema = z.object({
  userId: z.string().uuid(),
})

export const createContactRoutes = (deps: Dependencies) => {
  const router = Router()

  router.get('/', async (req, res) => {
    const result = await deps.contactRepo.getByOwner(req.user!.sub)
    resultToResponse(res, result)
  })

  router.post('/:id/transfer', validate(transferSchema), async (req, res) => {
    const result = await deps.contactRepo.transfer(req.params.id as string, req.body.userId)
    resultToResponse(res, result)
  })

  router.post('/:id/finish', async (req, res) => {
    const result = await deps.contactRepo.update(req.params.id as string, { status: 'finished' })
    resultToResponse(res, result)
  })

  return router
}
