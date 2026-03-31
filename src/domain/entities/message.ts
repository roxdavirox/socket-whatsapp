import type { Jid } from '../value-objects/jid.js'

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'

export type MessageDirection = 'incoming' | 'outgoing'

export type Message = {
  readonly id: string
  readonly chatId: string
  readonly contactJid: Jid
  readonly ownerId: string
  readonly type: MessageType
  readonly direction: MessageDirection
  readonly text: string | null
  readonly mediaUrl: string | null
  readonly mimetype: string | null
  readonly timestamp: Date
  readonly metadata: Record<string, unknown>
}

export type CreateMessage = Omit<Message, 'id' | 'timestamp'> & {
  readonly id?: string
  readonly timestamp?: Date
}
