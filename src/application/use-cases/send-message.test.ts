import { describe, it, expect, vi } from 'vitest'
import { Ok, Err, isOk, isErr } from '@tecnomancy/alchemy'
import { createSendMessage } from './send-message.js'
import type { Dependencies } from '../../config/container.js'

const mkDeps = (overrides: Partial<Dependencies> = {}) => ({
  sessionManager: {
    get: vi.fn(() => ({
      client: { sendText: vi.fn(async () => Ok('sent-id')) },
      ownerId: 'o1',
    })),
  },
  messageRepo: {
    add: vi.fn(async () => Ok('msg-id')),
  },
  ...overrides,
}) as unknown as Dependencies

describe('createSendMessage', () => {
  it('sends text and stores message', async () => {
    const deps = mkDeps()
    const send = createSendMessage(deps)
    const result = await send({ jid: '5511999999999@s.whatsapp.net', text: 'hello', ownerId: 'o1', chatId: 'c1' })

    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value).toBe('msg-id')
  })

  it('fails on invalid JID', async () => {
    const send = createSendMessage(mkDeps())
    const result = await send({ jid: 'invalid', text: 'hello', ownerId: 'o1', chatId: 'c1' })

    expect(isErr(result)).toBe(true)
  })

  it('fails when no active session', async () => {
    const deps = mkDeps({ sessionManager: { get: () => undefined } as never })
    const send = createSendMessage(deps)
    const result = await send({ jid: '5511999999999@s.whatsapp.net', text: 'hello', ownerId: 'o1', chatId: 'c1' })

    expect(isErr(result)).toBe(true)
  })

  it('propagates send error', async () => {
    const deps = mkDeps({
      sessionManager: {
        get: () => ({
          client: { sendText: async () => Err(new Error('send failed')) },
          ownerId: 'o1',
        }),
      } as never,
    })
    const send = createSendMessage(deps)
    const result = await send({ jid: '5511999999999@s.whatsapp.net', text: 'hello', ownerId: 'o1', chatId: 'c1' })

    expect(isErr(result)).toBe(true)
  })
})
