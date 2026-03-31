import { isOk } from '@tecnomancy/alchemy'
import type { Socket } from 'socket.io'
import type { Dependencies } from '../../../config/container.js'
import type { ServerToClientEvents, ClientToServerEvents } from '../events.js'

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>

export const handleChatNamespace = (socket: TypedSocket, deps: Dependencies) => {
  const userId = (socket.data as { userId?: string }).userId
  if (!userId) {
    socket.emit('error', 'Not authenticated')
    socket.disconnect()
    return
  }

  socket.on('message:send', async (data) => {
    const result = await deps.sendMessage({
      jid: data.jid,
      text: data.text,
      chatId: data.chatId,
      ownerId: userId,
    })

    if (!isOk(result)) {
      socket.emit('error', result.error.message)
    }
  })
}
