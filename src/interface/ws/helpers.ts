import type { Socket } from 'socket.io'

export const extractUserId = (socket: Socket): string | undefined =>
  (socket.data as { userId?: string }).userId

export const requireAuth = (socket: Socket): string | null => {
  const userId = extractUserId(socket)
  if (userId) return userId
  socket.emit('error', 'Not authenticated')
  socket.disconnect()
  return null
}
