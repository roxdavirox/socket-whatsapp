import { describe, it, expect } from 'vitest'
import { Ok, isOk } from '@tecnomancy/alchemy'
import { createGuardAgent } from './guard.js'
import type { AgentContext } from './types.js'

const noopAI = {
  analyze: async () => Ok('{"classification":"safe","confidence":1}'),
}

const mkCtx = (text: string | null): AgentContext => ({
  message: { id: '1', chatId: 'c1', contactJid: '5511@s.whatsapp.net' as never, ownerId: 'o1', type: 'text', direction: 'incoming', text, mediaUrl: null, mimetype: null, metadata: {}, timestamp: new Date() },
  contact: { id: 'ct1', jid: '5511@s.whatsapp.net' as never, ownerId: 'o1', assignedUserId: null, name: null, pushName: null, status: 'active', createdAt: new Date(), updatedAt: new Date() },
  history: [],
  ownerId: 'o1',
  metadata: {},
})

describe('createGuardAgent', () => {
  const guard = createGuardAgent(noopAI)

  it('passes null text', async () => {
    const result = await guard(mkCtx(null))
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('pass')
  })

  it('blocks spam patterns', async () => {
    const result = await guard(mkCtx('ganhe dinheiro agora'))
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('block')
  })

  it('blocks bit.ly links', async () => {
    const result = await guard(mkCtx('click here bit.ly/abc123'))
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('block')
  })

  it('passes normal messages', async () => {
    const result = await guard(mkCtx('bom dia, tudo bem?'))
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('pass')
  })
})
