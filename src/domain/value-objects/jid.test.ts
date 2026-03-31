import { describe, it, expect } from 'vitest'
import { isOk, isErr } from '@tecnomancy/alchemy'
import { parseJid, isGroupJid, jidToPhone, type Jid } from './jid.js'

describe('parseJid', () => {
  it('parses valid individual JID', () => {
    const result = parseJid('5511999999999@s.whatsapp.net')
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value).toBe('5511999999999@s.whatsapp.net')
  })

  it('parses valid group JID', () => {
    const result = parseJid('120363000000000000@g.us')
    expect(isOk(result)).toBe(true)
  })

  it('rejects invalid JID', () => {
    expect(isErr(parseJid('invalid'))).toBe(true)
    expect(isErr(parseJid(''))).toBe(true)
    expect(isErr(parseJid('abc@unknown.net'))).toBe(true)
  })
})

describe('isGroupJid', () => {
  it('detects group JID', () => {
    expect(isGroupJid('120363000000000000@g.us' as Jid)).toBe(true)
  })

  it('detects individual JID', () => {
    expect(isGroupJid('5511999999999@s.whatsapp.net' as Jid)).toBe(false)
  })
})

describe('jidToPhone', () => {
  it('extracts phone from JID', () => {
    expect(jidToPhone('5511999999999@s.whatsapp.net' as Jid)).toBe('5511999999999')
  })
})
