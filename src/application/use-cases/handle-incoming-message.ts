import { isOk, isSome, Err, Ok, type Result } from '@tecnomancy/alchemy'
import { mapBaileysMessage } from '../../infra/whatsapp/event-mapper.js'
import type { CreateMessage } from '../../domain/entities/message.js'
import { createPipeline } from '../agents/pipeline.js'
import { createGuardAgent } from '../agents/guard.js'
import { createConversationAgent } from '../agents/conversation.js'
import { createRoutingAgent } from '../agents/routing.js'
import { createSummaryAgent } from '../agents/summary.js'
import type { AgentDecision } from '../agents/types.js'
import type { Dependencies } from '../../config/container.js'

const resolveContact = async (
  deps: Dependencies,
  msg: CreateMessage,
  ownerId: string,
): Promise<Result<string, Error>> => {
  const existing = await deps.contactRepo.getByJid(msg.contactJid, ownerId)
  if (!isOk(existing)) return Err(existing.error)

  if (isSome(existing.value)) return Ok(existing.value.value.id)

  return deps.contactRepo.add({
    jid: msg.contactJid,
    ownerId,
    assignedUserId: null,
    name: null,
    pushName: (msg.metadata as Record<string, unknown>).pushName as string | null,
    status: 'active',
  })
}

const resolveChat = async (
  deps: Dependencies,
  contactId: string,
  ownerId: string,
): Promise<Result<string, Error>> => {
  const existing = await deps.chatRepo.getByContactId(contactId)
  if (isOk(existing) && isSome(existing.value)) return Ok(existing.value.value.id)

  return deps.chatRepo.add({
    contactId,
    ownerId,
    status: 'open',
    lastMessageAt: new Date(),
  })
}

const executeDecision = async (deps: Dependencies, decision: AgentDecision, ownerId: string) => {
  const session = deps.sessionManager.get(ownerId)

  switch (decision.type) {
    case 'respond':
      if (session) await session.client.sendText(decision.context.contact.jid, decision.text)
      break
    case 'route':
      await deps.contactRepo.update(decision.context.contact.id, { assignedUserId: decision.operatorId })
      break
    case 'block':
      deps.logger.info({ reason: decision.reason }, 'Message blocked')
      break
    case 'escalate':
      deps.logger.warn({ reason: decision.reason }, 'Message escalated')
      break
    case 'pass':
      break
  }
}

export const createHandleIncomingMessage = (deps: Dependencies) => {
  const pipeline = createPipeline([
    createGuardAgent(deps.ai),
    createConversationAgent(deps.ai),
    createRoutingAgent(deps.userRepo),
    createSummaryAgent(deps.ai),
  ], deps.logger)

  return async (raw: unknown, ownerId: string) => {
    const parsed = mapBaileysMessage(raw as never, ownerId)
    if (!isOk(parsed)) return deps.logger.warn({ err: parsed.error }, 'Failed to parse message')

    const msg = parsed.value
    if (msg.direction === 'outgoing') return

    const contactId = await resolveContact(deps, msg, ownerId)
    if (!isOk(contactId)) return deps.logger.error({ err: contactId.error }, 'Failed to resolve contact')

    const chatId = await resolveChat(deps, contactId.value, ownerId)
    if (!isOk(chatId)) return deps.logger.error({ err: chatId.error }, 'Failed to resolve chat')

    const stored = await deps.messageRepo.add({ ...msg, chatId: chatId.value })
    if (!isOk(stored)) return deps.logger.error({ err: stored.error }, 'Failed to store message')

    const history = await deps.messageRepo.getByChatId(chatId.value, 30)

    const contactResult = await deps.contactRepo.getById(contactId.value)
    if (!isOk(contactResult) || !isSome(contactResult.value)) return
    const contact = contactResult.value.value

    const decision = await pipeline({
      message: { ...msg, id: stored.value, chatId: chatId.value, timestamp: new Date() },
      contact,
      history: isOk(history) ? history.value : [],
      ownerId,
      metadata: {},
    })

    if (!isOk(decision)) return deps.logger.error({ err: decision.error }, 'Agent pipeline failed')

    await executeDecision(deps, decision.value, ownerId)
    deps.logger.info({ messageId: stored.value, decision: decision.value.type }, 'Message processed')
  }
}
