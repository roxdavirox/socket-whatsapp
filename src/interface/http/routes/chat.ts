import { Router } from 'express'
import { resultToResponse } from '../middleware/error-handler.js'
import type { Dependencies } from '../../../config/container.js'

export const createChatRoutes = (deps: Dependencies) => {
  const router = Router()

  router.get('/', async (req, res) => {
    const result = await deps.chatRepo.getByOwner(req.user!.sub)
    resultToResponse(res, result)
  })

  router.get('/:id/messages', async (req, res) => {
    const limit = Number(req.query.limit) || 50
    const result = await deps.messageRepo.getByChatId(req.params.id!, limit)
    resultToResponse(res, result)
  })

  router.post('/:id/close', async (req, res) => {
    const result = await deps.chatRepo.close(req.params.id!)
    resultToResponse(res, result)
  })

  return router
}
