import { io, type Socket } from 'socket.io-client'

type QrEvents = {
  readonly connect: () => void
  readonly disconnect: () => void
  readonly onQr: (handler: (qr: string) => void) => void
  readonly onConnected: (handler: () => void) => void
  readonly onDisconnected: (handler: (reason: string) => void) => void
  readonly onError: (handler: (msg: string) => void) => void
}

type ChatEvents = {
  readonly sendMessage: (data: { jid: string; text: string; chatId: string }) => void
  readonly onNewMessage: (handler: (message: unknown) => void) => void
  readonly onContactAssigned: (handler: (data: { contactId: string; userId: string }) => void) => void
}

export type SocketClient = {
  readonly qr: QrEvents
  readonly chat: ChatEvents
  readonly destroy: () => void
}

const createNamespace = (url: string, ns: string, token: string): Socket =>
  io(`${url}${ns}`, { auth: { token }, transports: ['websocket'] })

export const createSocketClient = (wsUrl: string, token: string): SocketClient => {
  const qrSocket = createNamespace(wsUrl, '/qr', token)
  const chatSocket = createNamespace(wsUrl, '/chat', token)

  return {
    qr: {
      connect: () => qrSocket.emit('session:connect'),
      disconnect: () => qrSocket.emit('session:disconnect'),
      onQr: (handler) => { qrSocket.on('qr', handler) },
      onConnected: (handler) => { qrSocket.on('connected', handler) },
      onDisconnected: (handler) => { qrSocket.on('disconnected', handler) },
      onError: (handler) => { qrSocket.on('error', handler) },
    },
    chat: {
      sendMessage: (data) => chatSocket.emit('message:send', data),
      onNewMessage: (handler) => { chatSocket.on('message:new', handler) },
      onContactAssigned: (handler) => { chatSocket.on('contact:assigned', handler) },
    },
    destroy: () => {
      qrSocket.disconnect()
      chatSocket.disconnect()
    },
  }
}
