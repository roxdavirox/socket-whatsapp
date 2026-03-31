import { describe, it, expect } from 'vitest'
import { Ok, isOk, Some, None, fromNullable } from '@tecnomancy/alchemy'
import { createRoutingAgent } from './routing.js'
import type { AgentContext } from './types.js'
import type { UserRepo } from '../../domain/ports/user-repo.js'

const mkCtx = (assignedUserId: string | null = null): AgentContext => ({
  message: { id: '1', chatId: 'c1', contactJid: '5511@s.whatsapp.net' as never, ownerId: 'o1', type: 'text', direction: 'incoming', text: 'hi', mediaUrl: null, mimetype: null, metadata: {}, timestamp: new Date() },
  contact: { id: 'ct1', jid: '5511@s.whatsapp.net' as never, ownerId: 'o1', assignedUserId, name: null, pushName: null, status: 'active' },
  history: [],
  ownerId: 'o1',
  metadata: {},
})

const mkUserRepo = (operators: { id: string; name: string }[] = []): UserRepo => ({
  getByEmail: async () => Ok(None),
  getById: async () => Ok(None),
  getOperators: async () => Ok(operators as never),
  add: async () => Ok(''),
})

describe('createRoutingAgent', () => {
  it('passes when contact already assigned', async () => {
    const agent = createRoutingAgent(mkUserRepo())
    const result = await agent(mkCtx('user-123'))
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('pass')
  })

  it('passes when no operators available', async () => {
    const agent = createRoutingAgent(mkUserRepo([]))
    const result = await agent(mkCtx())
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('pass')
  })

  it('routes to operator when unassigned', async () => {
    const agent = createRoutingAgent(mkUserRepo([{ id: 'op1', name: 'Operator 1' }]))
    const result = await agent(mkCtx())
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.type).toBe('route')
      if (result.value.type === 'route') expect(result.value.operatorId).toBe('op1')
    }
  })
})
