import { isOk } from '@tecnomancy/alchemy'
import type { Socket } from 'socket.io'
import type { Dependencies } from '../../../config/container.js'
import type { ServerToClientEvents, ClientToServerEvents } from '../events.js'
import { requireAuth } from '../helpers.js'

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>

export const handleChatNamespace = (socket: TypedSocket, deps: Dependencies) => {
  const userId = requireAuth(socket)
  if (!userId) return

  socket.on('message:send', async (data) => {
    const result = await deps.sendMessage({
      jid: data.jid,
      text: data.text,
      chatId: data.chatId,
      ownerId: userId,
    })

    if (!isOk(result)) socket.emit('error', result.error.message)
  })
}
