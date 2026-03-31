import type { DomainEvent, DomainEventType, EventHandler } from '../domain/events.js'

type AnyHandler = (event: never) => void | Promise<void>
type Listeners = Map<DomainEventType, Set<AnyHandler>>

export type EventBus = {
  readonly on: <T extends DomainEventType>(type: T, handler: EventHandler<T>) => void
  readonly off: <T extends DomainEventType>(type: T, handler: EventHandler<T>) => void
  readonly emit: (event: DomainEvent) => Promise<void>
}

export const createEventBus = (): EventBus => {
  const listeners: Listeners = new Map()

  return {
    on: (type, handler) => {
      const set = listeners.get(type) ?? new Set()
      set.add(handler as AnyHandler)
      listeners.set(type, set)
    },

    off: (type, handler) => {
      listeners.get(type)?.delete(handler as AnyHandler)
    },

    emit: async (event) => {
      const handlers = listeners.get(event.type)
      if (!handlers) return
      await Promise.allSettled(
        Array.from(handlers).map(h => (h as (e: DomainEvent) => void | Promise<void>)(event))
      )
    },
  }
}
