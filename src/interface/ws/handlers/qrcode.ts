import { isOk } from '@tecnomancy/alchemy'
import type { Socket } from 'socket.io'
import type { Dependencies } from '../../../config/container.js'
import type { ServerToClientEvents, ClientToServerEvents } from '../events.js'
import { requireAuth } from '../helpers.js'

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>

export const handleQRCodeNamespace = (socket: TypedSocket, deps: Dependencies) => {
  const userId = requireAuth(socket)
  if (!userId) return

  socket.on('session:connect', async () => {
    deps.logger.info({ userId }, 'Session connect requested')

    const result = await deps.manageSession.connect(userId, (qr) => {
      socket.emit('qr', qr)
    })

    if (!isOk(result)) socket.emit('error', result.error.message)
  })

  socket.on('session:disconnect', async () => {
    await deps.manageSession.disconnect(userId)
    socket.emit('disconnected', 'manual')
  })
}
