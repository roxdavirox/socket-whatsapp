import { Err, isOk, type Result } from '@tecnomancy/alchemy'
import { parseJid } from '../../domain/value-objects/jid.js'
import type { Dependencies } from '../../config/container.js'

type SendMediaInput = {
  readonly jid: string
  readonly buffer: Buffer
  readonly mimetype: string
  readonly filename: string
  readonly ownerId: string
  readonly chatId: string
}

export const createSendMedia = (deps: Dependencies) =>
  async (input: SendMediaInput): Promise<Result<string, Error>> => {
    const jidResult = parseJid(input.jid)
    if (!isOk(jidResult)) return jidResult

    const session = deps.sessionManager.get(input.ownerId)
    if (!session) return Err(new Error('No active session'))

    const uploaded = await deps.fileStorage.upload(
      { buffer: input.buffer, filename: input.filename, mimetype: input.mimetype },
      `${input.ownerId}/${Date.now()}-${input.filename}`,
    )
    if (!isOk(uploaded)) return uploaded

    const sent = await session.client.sendMedia(
      jidResult.value, input.buffer, input.mimetype, input.filename,
    )
    if (!isOk(sent)) return sent

    return deps.messageRepo.add({
      chatId: input.chatId,
      contactJid: jidResult.value,
      ownerId: input.ownerId,
      type: input.mimetype.startsWith('image/') ? 'image'
        : input.mimetype.startsWith('video/') ? 'video'
        : input.mimetype.startsWith('audio/') ? 'audio'
        : 'document',
      direction: 'outgoing',
      text: null,
      mediaUrl: uploaded.value,
      mimetype: input.mimetype,
      metadata: { baileysId: sent.value, filename: input.filename },
    })
  }
