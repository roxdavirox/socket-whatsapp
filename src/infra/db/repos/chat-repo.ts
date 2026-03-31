import { eq } from 'drizzle-orm'
import { tryCatchAsync, fromNullable } from '@tecnomancy/alchemy'
import { chats } from '../schema.js'
import type { DrizzleClient } from '../client.js'
import type { ChatRepo } from '../../../domain/ports/chat-repo.js'
import type { Chat, CreateChat } from '../../../domain/entities/chat.js'

export const createChatRepo = (db: DrizzleClient): ChatRepo => ({
  getById: (id) =>
    tryCatchAsync(async (i: string) => {
      const rows = await db.select().from(chats).where(eq(chats.id, i)).limit(1)
      return fromNullable(rows[0] as Chat | undefined)
    })(id),

  getByContactId: (contactId) =>
    tryCatchAsync(async (cId: string) => {
      const rows = await db.select().from(chats).where(eq(chats.contactId, cId)).limit(1)
      return fromNullable(rows[0] as Chat | undefined)
    })(contactId),

  getByOwner: (ownerId) =>
    tryCatchAsync(async (o: string) =>
      await db.select().from(chats).where(eq(chats.ownerId, o)) as Chat[]
    )(ownerId),

  add: (chat) =>
    tryCatchAsync(async (c: CreateChat) => {
      const [row] = await db.insert(chats).values(c).returning({ id: chats.id })
      return row!.id
    })(chat),

  updateStatus: (id, status) =>
    tryCatchAsync(async (i: string, s: Chat['status']) => {
      await db.update(chats).set({ status: s }).where(eq(chats.id, i))
    })(id, status),

  close: (id) =>
    tryCatchAsync(async (i: string) => {
      await db.update(chats)
        .set({ status: 'closed', closedAt: new Date() })
        .where(eq(chats.id, i))
    })(id),
})
