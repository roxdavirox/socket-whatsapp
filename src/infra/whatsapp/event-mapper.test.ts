import { describe, it, expect } from 'vitest'
import { isOk, isErr } from '@tecnomancy/alchemy'
import { mapBaileysMessage } from './event-mapper.js'

const mkRawMessage = (overrides: Record<string, unknown> = {}) => ({
  key: {
    remoteJid: '5511999999999@s.whatsapp.net',
    fromMe: false,
    id: 'msg-001',
    ...overrides,
  },
  message: {
    conversation: 'hello world',
  },
  pushName: 'John',
})

describe('mapBaileysMessage', () => {
  it('maps valid incoming text message', () => {
    const result = mapBaileysMessage(mkRawMessage() as never, 'owner-1')
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.direction).toBe('incoming')
      expect(result.value.type).toBe('text')
      expect(result.value.text).toBe('hello world')
      expect(result.value.contactJid).toBe('5511999999999@s.whatsapp.net')
      expect(result.value.ownerId).toBe('owner-1')
      expect(result.value.metadata).toEqual({ baileysId: 'msg-001', pushName: 'John' })
    }
  })

  it('maps outgoing message', () => {
    const result = mapBaileysMessage(mkRawMessage({ fromMe: true }) as never, 'owner-1')
    if (isOk(result)) expect(result.value.direction).toBe('outgoing')
  })

  it('fails on missing remoteJid', () => {
    const raw = { key: {}, message: {} } as never
    expect(isErr(mapBaileysMessage(raw, 'owner-1'))).toBe(true)
  })

  it('fails on invalid JID', () => {
    const raw = mkRawMessage({ remoteJid: 'invalid' })
    expect(isErr(mapBaileysMessage(raw as never, 'owner-1'))).toBe(true)
  })

  it('resolves image type', () => {
    const raw = { ...mkRawMessage(), message: { imageMessage: { caption: 'pic' } } }
    const result = mapBaileysMessage(raw as never, 'owner-1')
    if (isOk(result)) {
      expect(result.value.type).toBe('image')
      expect(result.value.text).toBe('pic')
    }
  })

  it('resolves audio type', () => {
    const raw = { ...mkRawMessage(), message: { audioMessage: {} } }
    const result = mapBaileysMessage(raw as never, 'owner-1')
    if (isOk(result)) expect(result.value.type).toBe('audio')
  })

  it('returns null text when no conversation', () => {
    const raw = { ...mkRawMessage(), message: { stickerMessage: {} } }
    const result = mapBaileysMessage(raw as never, 'owner-1')
    if (isOk(result)) expect(result.value.text).toBeNull()
  })
})
