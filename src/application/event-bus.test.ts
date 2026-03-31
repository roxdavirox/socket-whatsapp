import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from './event-bus.js'

describe('createEventBus', () => {
  it('emits to registered handlers', async () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('message.received', handler)

    await bus.emit({ type: 'message.received', message: {} as never, contact: {} as never })

    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not emit after unsubscribe', async () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('message.received', handler)
    bus.off('message.received', handler)

    await bus.emit({ type: 'message.received', message: {} as never, contact: {} as never })

    expect(handler).not.toHaveBeenCalled()
  })

  it('handles multiple handlers', async () => {
    const bus = createEventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('message.received', h1)
    bus.on('message.received', h2)

    await bus.emit({ type: 'message.received', message: {} as never, contact: {} as never })

    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('does not throw on emit without handlers', async () => {
    const bus = createEventBus()
    await expect(bus.emit({ type: 'message.received', message: {} as never, contact: {} as never })).resolves.toBeUndefined()
  })

  it('isolates handler errors via allSettled', async () => {
    const bus = createEventBus()
    const failing = vi.fn(async () => { throw new Error('boom') })
    const passing = vi.fn()
    bus.on('message.received', failing)
    bus.on('message.received', passing)

    await bus.emit({ type: 'message.received', message: {} as never, contact: {} as never })

    expect(passing).toHaveBeenCalledOnce()
  })
})
