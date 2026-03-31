import { eq } from 'drizzle-orm'
import { tryCatchAsync, fromNullable } from '@tecnomancy/alchemy'
import { sessions } from '../schema.js'
import type { DrizzleClient } from '../client.js'
import type { SessionStore } from '../../../domain/ports/session-store.js'
import type { Session, SessionStatus } from '../../../domain/entities/session.js'

export const createSessionStore = (db: DrizzleClient): SessionStore => ({
  get: (ownerId) =>
    tryCatchAsync(async (o: string) => {
      const rows = await db.select().from(sessions).where(eq(sessions.ownerId, o)).limit(1)
      return fromNullable(rows[0] as Session | undefined)
    })(ownerId),

  getAll: () =>
    tryCatchAsync(async () =>
      await db.select().from(sessions) as Session[]
    )(),

  save: (session) =>
    tryCatchAsync(async (s: Session) => {
      await db.insert(sessions)
        .values(s)
        .onConflictDoUpdate({
          target: sessions.ownerId,
          set: {
            status: s.status,
            qrCode: s.qrCode,
            connectedAt: s.connectedAt,
            disconnectedAt: s.disconnectedAt,
          },
        })
    })(session),

  updateStatus: (ownerId, status) =>
    tryCatchAsync(async (o: string, s: SessionStatus) => {
      const timestamps = {
        ...(s === 'connected' ? { connectedAt: new Date() } : {}),
        ...(s === 'disconnected' ? { disconnectedAt: new Date() } : {}),
      }
      await db.update(sessions).set({ status: s, ...timestamps }).where(eq(sessions.ownerId, o))
    })(ownerId, status),

  remove: (ownerId) =>
    tryCatchAsync(async (o: string) => {
      await db.delete(sessions).where(eq(sessions.ownerId, o))
    })(ownerId),
})
