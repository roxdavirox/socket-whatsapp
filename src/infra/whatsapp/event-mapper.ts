import { Ok, Err, isOk, type Result } from '@tecnomancy/alchemy'
import { parseJid } from '../../domain/value-objects/jid.js'
import type { CreateMessage, MessageType } from '../../domain/entities/message.js'
import type { proto } from '@whiskeysockets/baileys'

type BaileysMessage = proto.IWebMessageInfo

const resolveMessageType = (msg: BaileysMessage): MessageType => {
  const content = msg.message
  if (!content) return 'text'
  if (content.imageMessage) return 'image'
  if (content.videoMessage) return 'video'
  if (content.audioMessage) return 'audio'
  if (content.documentMessage) return 'document'
  if (content.stickerMessage) return 'sticker'
  if (content.locationMessage) return 'location'
  if (content.contactMessage) return 'contact'
  return 'text'
}

const extractText = (msg: BaileysMessage): string | null =>
  msg.message?.conversation
  ?? msg.message?.extendedTextMessage?.text
  ?? msg.message?.imageMessage?.caption
  ?? msg.message?.videoMessage?.caption
  ?? null

export const mapBaileysMessage = (
  raw: BaileysMessage,
  ownerId: string
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
    direction: raw.key?.fromMe ? 'outgoing' : 'incoming',
    text: extractText(raw),
    mediaUrl: null,
    mimetype: null,
    metadata: {
      baileysId: raw.key?.id,
      pushName: raw.pushName ?? null,
    },
  })
}
