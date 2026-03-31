export type ServerToClientEvents = {
  'qr': (qr: string) => void
  'connected': () => void
  'disconnected': (reason: string) => void
  'message:new': (message: unknown) => void
  'contact:assigned': (data: { contactId: string; userId: string }) => void
  'error': (message: string) => void
}

export type ClientToServerEvents = {
  'session:connect': () => void
  'session:disconnect': () => void
  'message:send': (data: { jid: string; text: string; chatId: string }) => void
}
