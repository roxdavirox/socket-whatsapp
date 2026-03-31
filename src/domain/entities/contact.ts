import type { Jid } from '../value-objects/jid.js'

export type ContactStatus = 'active' | 'finished' | 'archived'

export type Contact = {
  readonly id: string
  readonly jid: Jid
  readonly ownerId: string
  readonly assignedUserId: string | null
  readonly name: string | null
  readonly pushName: string | null
  readonly status: ContactStatus
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type CreateContact = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>
