import { eq, and } from 'drizzle-orm'
import { tryCatchAsync, fromNullable } from '@tecnomancy/alchemy'
import { contacts } from '../schema.js'
import type { DrizzleClient } from '../client.js'
import type { ContactRepo } from '../../../domain/ports/contact-repo.js'
import type { Contact } from '../../../domain/entities/contact.js'
import type { Jid } from '../../../domain/value-objects/jid.js'

export const createContactRepo = (db: DrizzleClient): ContactRepo => ({
  getByJid: (jid, ownerId) =>
    tryCatchAsync(async (j: Jid, o: string) => {
      const rows = await db.select().from(contacts)
        .where(and(eq(contacts.jid, j), eq(contacts.ownerId, o)))
        .limit(1)
      return fromNullable(rows[0] as Contact | undefined)
    })(jid, ownerId),

  getById: (id) =>
    tryCatchAsync(async (i: string) => {
      const rows = await db.select().from(contacts).where(eq(contacts.id, i)).limit(1)
      return fromNullable(rows[0] as Contact | undefined)
    })(id),

  getByOwner: (ownerId) =>
    tryCatchAsync(async (o: string) =>
      await db.select().from(contacts).where(eq(contacts.ownerId, o)) as Contact[]
    )(ownerId),

  add: (contact) =>
    tryCatchAsync(async (c: typeof contact) => {
      const [row] = await db.insert(contacts).values(c).returning({ id: contacts.id })
      return row!.id
    })(contact),

  update: (id, data) =>
    tryCatchAsync(async (i: string, d: typeof data) => {
      await db.update(contacts).set({ ...d, updatedAt: new Date() }).where(eq(contacts.id, i))
    })(id, data),

  transfer: (contactId, newUserId) =>
    tryCatchAsync(async (cId: string, uId: string) => {
      await db.update(contacts)
        .set({ assignedUserId: uId, updatedAt: new Date() })
        .where(eq(contacts.id, cId))
    })(contactId, newUserId),
})
