import { isOk, Err, type Result, Ok } from '@tecnomancy/alchemy'
import { createBaileysClient } from '../../infra/whatsapp/baileys-client.js'
import type { Dependencies } from '../../config/container.js'

export const createManageSession = (deps: Dependencies) => ({
  connect: async (ownerId: string, onQR: (qr: string) => void): Promise<Result<void, Error>> => {
    const existing = deps.sessionManager.get(ownerId)
    if (existing) return Ok(undefined)

    const client = await createBaileysClient(
      deps.env.WA_AUTH_DIR,
      ownerId,
      {
        onQR,
        onConnected: async () => {
          await deps.sessionStore.updateStatus(ownerId, 'connected')
          await deps.eventBus.emit({ type: 'session.status_changed', ownerId, status: 'connected' })
        },
        onDisconnected: async (reason) => {
          if (reason === 'logged_out') {
            await deps.sessionManager.remove(ownerId)
          }
          await deps.eventBus.emit({ type: 'session.status_changed', ownerId, status: 'disconnected' })
        },
        onMessage: (msg) => {
          deps.handleIncomingMessage(msg, ownerId)
        },
      },
      deps.logger,
    )

    if (!isOk(client)) return Err(client.error)

    deps.sessionManager.set(ownerId, client.value)
    await deps.sessionStore.save({
      id: '',
      ownerId,
      status: 'connecting',
      qrCode: null,
      connectedAt: null,
      disconnectedAt: null,
    })

    return Ok(undefined)
  },

  disconnect: (ownerId: string): Promise<Result<void, Error>> =>
    deps.sessionManager.remove(ownerId),

  restoreAll: async (): Promise<void> => {
    const sessions = await deps.sessionStore.getAll()
    if (!isOk(sessions)) return

    const restorable = sessions.value.filter(
      s => s.status === 'connected' || s.status === 'connecting',
    )

    await restorable.reduce(
      (acc, session) => acc.then(async () => {
        deps.logger.info({ ownerId: session.ownerId }, 'Restoring session')
        await deps.manageSession.connect(session.ownerId, () => {})
      }),
      Promise.resolve(),
    )
  },
})

export type ManageSession = ReturnType<typeof createManageSession>
