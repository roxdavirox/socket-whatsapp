import { Server } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import { isOk } from '@tecnomancy/alchemy'
import { handleQRCodeNamespace } from './handlers/qrcode.js'
import { handleChatNamespace } from './handlers/chat.js'
import type { Dependencies } from '../../config/container.js'
import type { ServerToClientEvents, ClientToServerEvents } from './events.js'

export const createSocketServer = (httpServer: HttpServer, deps: Dependencies) => {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: deps.env.CORS_ORIGIN },
  })

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string | undefined
    if (!token) return next(new Error('Missing token'))

    const result = await deps.authenticate.validateToken(token)
    if (!isOk(result)) return next(new Error('Invalid token'))

    socket.data = { userId: result.value.sub }
    next()
  })

  const qrNamespace = io.of('/qr')
  qrNamespace.on('connection', (socket) => handleQRCodeNamespace(socket as never, deps))

  const chatNamespace = io.of('/chat')
  chatNamespace.on('connection', (socket) => handleChatNamespace(socket as never, deps))

  deps.eventBus.on('message.received', (event) => {
    const room = event.contact.assignedUserId ?? event.contact.ownerId
    chatNamespace.to(room).emit('message:new', event.message)
  })

  deps.eventBus.on('contact.assigned', (event) => {
    chatNamespace.emit('contact:assigned', {
      contactId: event.contactId,
      userId: event.userId,
    })
  })

  return io
}
