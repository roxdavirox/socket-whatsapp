import { Err, isOk, type Result } from '@tecnomancy/alchemy'
import { parseJid } from '../../domain/value-objects/jid.js'
import type { Dependencies } from '../../config/container.js'

type SendMessageInput = {
  readonly jid: string
  readonly text: string
  readonly ownerId: string
  readonly chatId: string
}

export const createSendMessage = (deps: Dependencies) =>
  async (input: SendMessageInput): Promise<Result<string, Error>> => {
    const jidResult = parseJid(input.jid)
    if (!isOk(jidResult)) return jidResult

    const session = deps.sessionManager.get(input.ownerId)
    if (!session) return Err(new Error('No active session'))

    const sent = await session.client.sendText(jidResult.value, input.text)
    if (!isOk(sent)) return sent

    return deps.messageRepo.add({
      chatId: input.chatId,
      contactJid: jidResult.value,
      ownerId: input.ownerId,
      type: 'text',
      direction: 'outgoing',
      text: input.text,
      mediaUrl: null,
      mimetype: null,
      metadata: { baileysId: sent.value },
    })
  }
