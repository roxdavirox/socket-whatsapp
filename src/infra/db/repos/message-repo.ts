import { eq, desc } from 'drizzle-orm'
import { tryCatchAsync, fromNullable } from '@tecnomancy/alchemy'
import { messages } from '../schema.js'
import type { DrizzleClient } from '../client.js'
import type { MessageRepo } from '../../../domain/ports/message-repo.js'
import type { Message, CreateMessage } from '../../../domain/entities/message.js'

export const createMessageRepo = (db: DrizzleClient): MessageRepo => ({
  getById: (id) =>
    tryCatchAsync(async (i: string) => {
      const rows = await db.select().from(messages).where(eq(messages.id, i)).limit(1)
      return fromNullable(rows[0] as Message | undefined)
    })(id),

  getByChatId: (chatId, limit = 50) =>
    tryCatchAsync(async (cId: string, lim: number) =>
      await db.select().from(messages)
        .where(eq(messages.chatId, cId))
        .orderBy(desc(messages.timestamp))
        .limit(lim) as Message[]
    )(chatId, limit),

  getByContact: (contactJid, _ownerId, limit = 50) =>
    tryCatchAsync(async (jid: string, lim: number) =>
      await db.select().from(messages)
        .where(eq(messages.contactJid, jid))
        .orderBy(desc(messages.timestamp))
        .limit(lim) as Message[]
    )(contactJid, limit),

  add: (message) =>
    tryCatchAsync(async (m: CreateMessage) => {
      const [row] = await db.insert(messages).values(m).returning({ id: messages.id })
      return row!.id
    })(message),
})
