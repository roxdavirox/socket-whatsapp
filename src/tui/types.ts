export type { Message, CreateMessage, MessageType, MessageDirection } from '../domain/entities/message.js'
export type { Contact, ContactStatus } from '../domain/entities/contact.js'
export type { Chat } from '../domain/entities/chat.js'
export type { Jid } from '../domain/value-objects/jid.js'

export type AuthResult = {
  readonly token: string
  readonly user: { id: string; email: string; name: string; role: string }
}
