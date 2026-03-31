import { describe, it, expect } from 'vitest'
import { Ok, isOk } from '@tecnomancy/alchemy'
import { createConversationAgent } from './conversation.js'
import type { AgentContext } from './types.js'

const mkAI = (response: string) => ({
  analyze: async () => Ok(response),
})

const mkCtx = (text: string | null, history: AgentContext['history'] = []): AgentContext => ({
  message: { id: '1', chatId: 'c1', contactJid: '5511@s.whatsapp.net' as never, ownerId: 'o1', type: 'text', direction: 'incoming', text, mediaUrl: null, mimetype: null, metadata: {}, timestamp: new Date() },
  contact: { id: 'ct1', jid: '5511@s.whatsapp.net' as never, ownerId: 'o1', assignedUserId: null, name: null, pushName: null, status: 'active', createdAt: new Date(), updatedAt: new Date() },
  history,
  ownerId: 'o1',
  metadata: {},
})

describe('createConversationAgent', () => {
  it('passes on null text', async () => {
    const agent = createConversationAgent(mkAI(''))
    const result = await agent(mkCtx(null))
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('pass')
  })

  it('responds when shouldAutoReply is true', async () => {
    const ai = mkAI('{"intent":"greeting","shouldAutoReply":true,"suggestedReply":"Olá!"}')
    const agent = createConversationAgent(ai)
    const result = await agent(mkCtx('oi'))

    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.type).toBe('respond')
      if (result.value.type === 'respond') expect(result.value.text).toBe('Olá!')
    }
  })

  it('passes when shouldAutoReply is false', async () => {
    const ai = mkAI('{"intent":"question","shouldAutoReply":false,"suggestedReply":""}')
    const agent = createConversationAgent(ai)
    const result = await agent(mkCtx('como funciona?'))

    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('pass')
  })

  it('passes on invalid JSON from AI', async () => {
    const ai = mkAI('not valid json at all')
    const agent = createConversationAgent(ai)
    const result = await agent(mkCtx('hello'))

    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('pass')
  })

  it('includes history in context', async () => {
    const ai = mkAI('{"intent":"other","shouldAutoReply":false}')
    const agent = createConversationAgent(ai)
    const history = [
      { id: 'h1', chatId: 'c1', contactJid: '5511@s.whatsapp.net' as never, ownerId: 'o1', type: 'text' as const, direction: 'incoming' as const, text: 'previous msg', mediaUrl: null, mimetype: null, metadata: {}, timestamp: new Date() },
    ]
    const result = await agent(mkCtx('new msg', history))

    expect(isOk(result)).toBe(true)
  })
})
