import { Ok, Err, isOk, pipe, type Result } from '@tecnomancy/alchemy'
import { parseJid } from '../../domain/value-objects/jid.js'
import type { CreateMessage, MessageType, MessageDirection } from '../../domain/entities/message.js'
import type { proto } from '@whiskeysockets/baileys'

type BaileysMessage = proto.IWebMessageInfo

type ContentCheck = readonly [(msg: NonNullable<BaileysMessage['message']>) => unknown, MessageType]

const CONTENT_CHECKS: ContentCheck[] = [
  [c => c.imageMessage, 'image'],
  [c => c.videoMessage, 'video'],
  [c => c.audioMessage, 'audio'],
  [c => c.documentMessage, 'document'],
  [c => c.stickerMessage, 'sticker'],
  [c => c.locationMessage, 'location'],
  [c => c.contactMessage, 'contact'],
]

const resolveMessageType = (msg: BaileysMessage): MessageType =>
  pipe(
    msg.message,
    (content) => content
      ? CONTENT_CHECKS.find(([check]) => check(content))?.[1] ?? 'text'
      : 'text',
  )

const resolveDirection = (fromMe: boolean | null | undefined): MessageDirection =>
  fromMe ? 'outgoing' : 'incoming'

const extractText = (msg: BaileysMessage): string | null =>
  msg.message?.conversation
  ?? msg.message?.extendedTextMessage?.text
  ?? msg.message?.imageMessage?.caption
  ?? msg.message?.videoMessage?.caption
  ?? null

export const mapBaileysMessage = (
  raw: BaileysMessage,
  ownerId: string,
): Result<CreateMessage, Error> => {
  const remoteJid = raw.key?.remoteJid
  if (!remoteJid) return Err(new Error('Missing remoteJid'))

  const jidResult = parseJid(remoteJid)
  if (!isOk(jidResult)) return Err(jidResult.error)

  return Ok({
    chatId: '',
    contactJid: jidResult.value,
    ownerId,
    type: resolveMessageType(raw),
    direction: resolveDirection(raw.key?.fromMe),
    text: extractText(raw),
    mediaUrl: null,
    mimetype: null,
    metadata: {
      baileysId: raw.key?.id,
      pushName: raw.pushName ?? null,
    },
  })
}
