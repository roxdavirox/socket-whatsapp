import { describe, it, expect } from 'vitest'
import { formatMessage, formatHistory, formatFullHistory } from './shared.js'

describe('formatMessage', () => {
  it('formats incoming message', () => {
    expect(formatMessage({ direction: 'incoming', text: 'hello' })).toBe('User: hello')
  })

  it('formats outgoing message', () => {
    expect(formatMessage({ direction: 'outgoing', text: 'reply' })).toBe('Bot: reply')
  })

  it('formats null text as [media]', () => {
    expect(formatMessage({ direction: 'incoming', text: null })).toBe('User: [media]')
  })
})

describe('formatHistory', () => {
  it('limits to last 10 messages', () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      direction: 'incoming' as const,
      text: `msg${i}`,
    }))
    const result = formatHistory(history)
    const lines = result.split('\n')
    expect(lines).toHaveLength(10)
    expect(lines[0]).toBe('User: msg10')
    expect(lines[9]).toBe('User: msg19')
  })

  it('returns empty string for empty history', () => {
    expect(formatHistory([])).toBe('')
  })
})

describe('formatFullHistory', () => {
  it('formats all messages', () => {
    const history = [
      { direction: 'incoming', text: 'hi' },
      { direction: 'outgoing', text: 'hello' },
    ]
    expect(formatFullHistory(history)).toBe('User: hi\nBot: hello')
  })
})
