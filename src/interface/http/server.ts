import express from 'express'
import cors from 'cors'
import { pinoHttp } from 'pino-http'
import { createAuthRoutes } from './routes/auth.js'
import { createChatRoutes } from './routes/chat.js'
import { createContactRoutes } from './routes/contact.js'
import { createMessageRoutes } from './routes/message.js'
import { createAuthMiddleware } from './middleware/auth.js'
import { errorHandler } from './middleware/error-handler.js'
import type { Dependencies } from '../../config/container.js'

export const createServer = (deps: Dependencies) => {
  const app = express()
  const authMiddleware = createAuthMiddleware(deps.authenticate)

  app.use(cors({ origin: deps.env.CORS_ORIGIN }))
  app.use(express.json())
  app.use(pinoHttp({ logger: deps.logger }))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', sessions: deps.sessionManager.getAll().size })
  })

  app.use('/api/auth', createAuthRoutes(deps))
  app.use('/api/chats', authMiddleware, createChatRoutes(deps))
  app.use('/api/contacts', authMiddleware, createContactRoutes(deps))
  app.use('/api/messages', authMiddleware, createMessageRoutes(deps))

  app.use(errorHandler)

  return app
}
