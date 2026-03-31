import { Ok, isOk, fromNullable, isSome, type Result } from '@tecnomancy/alchemy'
import type { WAClient } from '../../domain/ports/wa-client.js'
import type { SessionStore } from '../../domain/ports/session-store.js'
import type { Logger } from '../../config/logger.js'

type ActiveSession = {
  readonly client: WAClient
  readonly ownerId: string
}

export type SessionManager = {
  readonly get: (ownerId: string) => ActiveSession | undefined
  readonly set: (ownerId: string, client: WAClient) => void
  readonly remove: (ownerId: string) => Promise<Result<void, Error>>
  readonly getAll: () => ReadonlyMap<string, ActiveSession>
}

export const createSessionManager = (
  sessionStore: SessionStore,
  _eventBus: unknown,
  logger: Logger,
): SessionManager => {
  const activeSessions = new Map<string, ActiveSession>()

  return {
    get: (ownerId) => activeSessions.get(ownerId),

    set: (ownerId, client) => {
      activeSessions.set(ownerId, { client, ownerId })
      logger.info({ ownerId }, 'Session activated')
    },

    remove: async (ownerId) => {
      const session = fromNullable(activeSessions.get(ownerId))
      if (!isSome(session)) return Ok(undefined)

      const closed = await session.value.client.close()
      if (!isOk(closed)) return closed

      activeSessions.delete(ownerId)
      const updated = await sessionStore.updateStatus(ownerId, 'disconnected')
      if (!isOk(updated)) return updated

      logger.info({ ownerId }, 'Session removed')
      return Ok(undefined)
    },

    getAll: () => activeSessions,
  }
}
