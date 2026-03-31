import type { Message } from './entities/message.js'
import type { Contact } from './entities/contact.js'
import type { SessionStatus } from './entities/session.js'
import type { Jid } from './value-objects/jid.js'

export type DomainEvent =
  | { type: 'message.received'; message: Message; contact: Contact }
  | { type: 'message.sent'; message: Message }
  | { type: 'contact.created'; contact: Contact }
  | { type: 'contact.assigned'; contactId: string; userId: string }
  | { type: 'contact.finished'; contactId: string }
  | { type: 'session.status_changed'; ownerId: string; status: SessionStatus }
  | { type: 'session.qr_generated'; ownerId: string; qr: string }
  | { type: 'chat.opened'; chatId: string; contactJid: Jid }
  | { type: 'chat.closed'; chatId: string }

export type DomainEventType = DomainEvent['type']

export type EventHandler<T extends DomainEventType> = (
  event: Extract<DomainEvent, { type: T }>
) => void | Promise<void>
