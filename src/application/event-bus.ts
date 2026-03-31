import type { DomainEvent, DomainEventType, EventHandler } from '../domain/events.js'

type AnyHandler = (event: never) => void | Promise<void>
type Listeners = Map<DomainEventType, Set<AnyHandler>>

export type EventBus = {
  readonly on: <T extends DomainEventType>(type: T, handler: EventHandler<T>) => void
  readonly off: <T extends DomainEventType>(type: T, handler: EventHandler<T>) => void
  readonly emit: (event: DomainEvent) => Promise<void>
}

const invokeWith = (event: DomainEvent) => (handler: AnyHandler) =>
  (handler as (e: DomainEvent) => void | Promise<void>)(event)

const getOrCreate = (map: Listeners, type: DomainEventType) => {
  const existing = map.get(type)
  if (existing) return existing
  const set = new Set<AnyHandler>()
  map.set(type, set)
  return set
}

export const createEventBus = (): EventBus => {
  const listeners: Listeners = new Map()

  return {
    on: (type, handler) => getOrCreate(listeners, type).add(handler as AnyHandler),

    off: (type, handler) => listeners.get(type)?.delete(handler as AnyHandler),

    emit: async (event) => {
      const handlers = listeners.get(event.type)
      if (!handlers) return
      await Promise.allSettled(Array.from(handlers).map(invokeWith(event)))
    },
  }
}
