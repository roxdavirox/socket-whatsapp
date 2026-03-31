import { Ok, Err, tryCatch, isOk, type Result } from '@tecnomancy/alchemy'

type Token<T> = symbol & { readonly __type: T }

type Factory<T> = (resolve: <U>(token: Token<U>) => U) => T

type Scope = 'singleton' | 'transient'

type Registration<T> = {
  readonly factory: Factory<T>
  readonly scope: Scope
}

export type Container = {
  readonly resolve: <T>(token: Token<T>) => T
  readonly tryResolve: <T>(token: Token<T>) => Result<T, Error>
  readonly register: <T>(token: Token<T>, factory: Factory<T>, scope?: Scope) => void
  readonly has: <T>(token: Token<T>) => boolean
}

export const createToken = <T>(name: string): Token<T> =>
  Symbol(name) as Token<T>

export const createContainer = (): Container => {
  const registry = new Map<symbol, Registration<unknown>>()
  const singletons = new Map<symbol, unknown>()

  const resolve = <T>(token: Token<T>): T => {
    const cached = singletons.get(token)
    if (cached !== undefined) return cached as T

    const reg = registry.get(token) as Registration<T> | undefined
    if (!reg) throw new Error(`No registration for token: ${token.toString()}`)

    const instance = reg.factory(resolve)

    if (reg.scope === 'singleton') singletons.set(token, instance)
    return instance
  }

  const tryResolve = <T>(token: Token<T>): Result<T, Error> => {
    const reg = registry.get(token)
    if (!reg) return Err(new Error(`No registration for token: ${token.toString()}`))

    const cached = singletons.get(token)
    if (cached !== undefined) return Ok(cached as T)

    const result = tryCatch(() => (reg as Registration<T>).factory(resolve))()
    if (!isOk(result)) return result
    if (reg.scope === 'singleton') singletons.set(token, result.value)
    return result
  }

  return {
    resolve,
    tryResolve,
    register: (token, factory, scope = 'singleton') => {
      registry.set(token, { factory: factory as Factory<unknown>, scope })
    },
    has: (token) => registry.has(token),
  }
}
