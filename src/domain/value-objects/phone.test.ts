import { describe, it, expect } from 'vitest'
import { isOk, isErr } from '@tecnomancy/alchemy'
import { parsePhone } from './phone.js'

describe('parsePhone', () => {
  it('parses valid BR phone', () => {
    const result = parsePhone('5511999999999')
    expect(isOk(result)).toBe(true)
  })

  it('parses valid international phone', () => {
    expect(isOk(parsePhone('14155552671'))).toBe(true)
  })

  it('rejects short numbers', () => {
    expect(isErr(parsePhone('123'))).toBe(true)
  })

  it('rejects non-numeric', () => {
    expect(isErr(parsePhone('abc'))).toBe(true)
  })

  it('rejects empty', () => {
    expect(isErr(parsePhone(''))).toBe(true)
  })
})
