import type { Result, Option } from '@tecnomancy/alchemy'
import type { Contact, CreateContact } from '../entities/contact.js'
import type { Jid } from '../value-objects/jid.js'

export type ContactRepo = {
  readonly getByJid: (jid: Jid, ownerId: string) => Promise<Result<Option<Contact>, Error>>
  readonly getById: (id: string) => Promise<Result<Option<Contact>, Error>>
  readonly getByOwner: (ownerId: string) => Promise<Result<Contact[], Error>>
  readonly add: (contact: CreateContact) => Promise<Result<string, Error>>
  readonly update: (id: string, data: Partial<Pick<Contact, 'assignedUserId' | 'status' | 'name'>>) => Promise<Result<void, Error>>
  readonly transfer: (contactId: string, newUserId: string) => Promise<Result<void, Error>>
}
