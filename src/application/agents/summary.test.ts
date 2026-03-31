import { describe, it, expect } from 'vitest'
import { Ok, isOk } from '@tecnomancy/alchemy'
import { createSummaryAgent } from './summary.js'
import type { AgentContext } from './types.js'

const mkAI = (response: string) => ({
  analyze: async () => Ok(response),
})

const mkMsg = (i: number) => ({
  id: `m${i}`, chatId: 'c1', contactJid: '5511@s.whatsapp.net' as never, ownerId: 'o1',
  type: 'text' as const, direction: 'incoming' as const, text: `message ${i}`,
  mediaUrl: null, mimetype: null, metadata: {}, timestamp: new Date(),
})

const mkCtx = (historyLength: number): AgentContext => ({
  message: mkMsg(0),
  contact: { id: 'ct1', jid: '5511@s.whatsapp.net' as never, ownerId: 'o1', assignedUserId: null, name: null, pushName: null, status: 'active', createdAt: new Date(), updatedAt: new Date() },
  history: Array.from({ length: historyLength }, (_, i) => mkMsg(i)),
  ownerId: 'o1',
  metadata: {},
})

describe('createSummaryAgent', () => {
  it('passes when history is below threshold', async () => {
    const agent = createSummaryAgent(mkAI(''))
    const result = await agent(mkCtx(5))
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('pass')
  })

  it('passes with summary metadata when history is above threshold', async () => {
    const agent = createSummaryAgent(mkAI('A conversation about orders.'))
    const result = await agent(mkCtx(25))
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.type).toBe('pass')
      if (result.value.type === 'pass') {
        expect(result.value.context.metadata.summary).toBeDefined()
      }
    }
  })

  it('passes at exactly threshold', async () => {
    const agent = createSummaryAgent(mkAI(''))
    const result = await agent(mkCtx(19))
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('pass')
  })
})
