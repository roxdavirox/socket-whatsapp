import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { tryCatchAsync, isOk, type Result } from '@tecnomancy/alchemy'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import type { WAClient } from '../../domain/ports/wa-client.js'
import type { Jid } from '../../domain/value-objects/jid.js'
import type { Logger } from '../../config/logger.js'

type ConnectionEvent = {
  readonly onQR: (qr: string) => void
  readonly onConnected: () => void
  readonly onDisconnected: (reason: string) => void
  readonly onMessage: (msg: unknown) => void
}

export const createBaileysClient = (
  authDir: string,
  ownerId: string,
  events: ConnectionEvent,
  logger: Logger,
): Promise<Result<WAClient, Error>> =>
  tryCatchAsync(async (aDir: string, oId: string) => {
    const sessionDir = join(aDir, oId)
    await mkdir(sessionDir, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    const { version } = await fetchLatestBaileysVersion()

    const sock: WASocket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: logger.child({ module: 'baileys' }) as never,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update
      if (qr) events.onQR(qr)
      if (connection === 'open') events.onConnected()
      if (connection === 'close') {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode
        const shouldReconnect = reason !== DisconnectReason.loggedOut
        events.onDisconnected(
          shouldReconnect ? 'reconnecting' : 'logged_out'
        )
      }
    })

    sock.ev.on('messages.upsert', ({ messages: msgs }) => {
      msgs.forEach(m => events.onMessage(m))
    })

    const client: WAClient = {
      sendText: (jid: Jid, text: string) =>
        tryCatchAsync(async (j: string, t: string) => {
          const sent = await sock.sendMessage(j, { text: t })
          return sent?.key?.id ?? ''
        })(jid, text),

      sendMedia: (jid: Jid, buffer: Buffer, mimetype: string, filename?: string) =>
        tryCatchAsync(async (j: string, buf: Buffer, mime: string, fname: string | undefined) => {
          const type = mime.startsWith('image/') ? 'image'
            : mime.startsWith('video/') ? 'video'
            : mime.startsWith('audio/') ? 'audio'
            : 'document'

          const msg = type === 'image' ? { image: buf, mimetype: mime }
            : type === 'video' ? { video: buf, mimetype: mime }
            : type === 'audio' ? { audio: buf, mimetype: mime }
            : { document: buf, mimetype: mime, fileName: fname ?? 'file' }

          const sent = await sock.sendMessage(j, msg)
          return sent?.key?.id ?? ''
        })(jid, buffer, mimetype, filename),

      getProfilePicture: (jid: Jid) =>
        tryCatchAsync(async (j: string) => {
          const result = await tryCatchAsync(
            (id: string) => sock.profilePictureUrl(id, 'image'),
          )(j)
          return isOk(result) ? result.value ?? null : null
        })(jid),

      close: () =>
        tryCatchAsync(async () => {
          sock.end(undefined)
        })(),
    }

    return client
  })(authDir, ownerId)
