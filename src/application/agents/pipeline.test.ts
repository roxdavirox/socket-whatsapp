import { describe, it, expect, vi } from 'vitest'
import { Ok, Err, isOk, isErr } from '@tecnomancy/alchemy'
import { createPipeline } from './pipeline.js'
import type { Agent, AgentContext } from './types.js'

const mkCtx = (overrides?: Partial<AgentContext>): AgentContext => ({
  message: { id: '1', chatId: 'c1', contactJid: '5511@s.whatsapp.net' as never, ownerId: 'o1', type: 'text', direction: 'incoming', text: 'hi', mediaUrl: null, mimetype: null, metadata: {}, timestamp: new Date() },
  contact: { id: 'ct1', jid: '5511@s.whatsapp.net' as never, ownerId: 'o1', assignedUserId: null, name: null, pushName: null, status: 'active' },
  history: [],
  ownerId: 'o1',
  metadata: {},
  ...overrides,
})

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn(() => logger) } as never

describe('createPipeline', () => {
  it('returns pass when no agents', async () => {
    const pipeline = createPipeline([], logger)
    const result = await pipeline(mkCtx())
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('pass')
  })

  it('short-circuits on respond', async () => {
    const agent1: Agent = async (ctx) => Ok({ type: 'respond', text: 'hello', context: ctx })
    const agent2: Agent = vi.fn()

    const pipeline = createPipeline([agent1, agent2], logger)
    const result = await pipeline(mkCtx())

    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.type).toBe('respond')
      if (result.value.type === 'respond') expect(result.value.text).toBe('hello')
    }
    expect(agent2).not.toHaveBeenCalled()
  })

  it('chains pass agents', async () => {
    const agent1: Agent = async (ctx) => Ok({ type: 'pass', context: { ...ctx, metadata: { ...ctx.metadata, a1: true } } })
    const agent2: Agent = async (ctx) => Ok({ type: 'pass', context: { ...ctx, metadata: { ...ctx.metadata, a2: true } } })

    const pipeline = createPipeline([agent1, agent2], logger)
    const result = await pipeline(mkCtx())

    expect(isOk(result)).toBe(true)
    if (isOk(result) && result.value.type === 'pass') {
      expect(result.value.context.metadata).toEqual({ a1: true, a2: true })
    }
  })

  it('skips failed agents (fail-open)', async () => {
    const failAgent: Agent = async () => Err(new Error('boom'))
    const passAgent: Agent = async (ctx) => Ok({ type: 'pass', context: ctx })

    const pipeline = createPipeline([failAgent, passAgent], logger)
    const result = await pipeline(mkCtx())

    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('pass')
  })

  it('short-circuits on block', async () => {
    const blockAgent: Agent = async () => Ok({ type: 'block', reason: 'spam' })
    const nextAgent: Agent = vi.fn()

    const pipeline = createPipeline([blockAgent, nextAgent], logger)
    const result = await pipeline(mkCtx())

    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.type).toBe('block')
    expect(nextAgent).not.toHaveBeenCalled()
  })
})
