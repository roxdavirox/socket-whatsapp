import { describe, it, expect } from 'vitest'
import { isOk, isErr } from '@tecnomancy/alchemy'
import { createContainer, createToken } from './ioc.js'

describe('IoC Container', () => {
  it('resolves registered singleton', () => {
    const ioc = createContainer()
    const Token = createToken<string>('greeting')
    ioc.register(Token, () => 'hello')

    expect(ioc.resolve(Token)).toBe('hello')
  })

  it('singleton returns same instance', () => {
    const ioc = createContainer()
    const Token = createToken<{ id: number }>('obj')
    let counter = 0
    ioc.register(Token, () => ({ id: ++counter }))

    const a = ioc.resolve(Token)
    const b = ioc.resolve(Token)
    expect(a).toBe(b)
    expect(counter).toBe(1)
  })

  it('transient returns new instance each time', () => {
    const ioc = createContainer()
    const Token = createToken<{ id: number }>('obj')
    let counter = 0
    ioc.register(Token, () => ({ id: ++counter }), 'transient')

    const a = ioc.resolve(Token)
    const b = ioc.resolve(Token)
    expect(a).not.toBe(b)
    expect(counter).toBe(2)
  })

  it('resolves dependencies between tokens', () => {
    const ioc = createContainer()
    const Name = createToken<string>('name')
    const Greeter = createToken<string>('greeter')

    ioc.register(Name, () => 'World')
    ioc.register(Greeter, (r) => `Hello, ${r(Name)}!`)

    expect(ioc.resolve(Greeter)).toBe('Hello, World!')
  })

  it('throws on unregistered token', () => {
    const ioc = createContainer()
    const Missing = createToken<string>('missing')

    expect(() => ioc.resolve(Missing)).toThrow('No registration')
  })

  it('tryResolve returns Err on unregistered', () => {
    const ioc = createContainer()
    const Missing = createToken<string>('missing')

    expect(isErr(ioc.tryResolve(Missing))).toBe(true)
  })

  it('tryResolve returns Ok on registered', () => {
    const ioc = createContainer()
    const Token = createToken<number>('num')
    ioc.register(Token, () => 42)

    const result = ioc.tryResolve(Token)
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value).toBe(42)
  })

  it('has returns true/false', () => {
    const ioc = createContainer()
    const A = createToken<string>('a')
    const B = createToken<string>('b')
    ioc.register(A, () => 'a')

    expect(ioc.has(A)).toBe(true)
    expect(ioc.has(B)).toBe(false)
  })

  it('deep dependency chain resolves correctly', () => {
    const ioc = createContainer()
    const Config = createToken<{ port: number }>('config')
    const Logger = createToken<{ level: string }>('logger')
    const Server = createToken<string>('server')

    ioc.register(Config, () => ({ port: 3000 }))
    ioc.register(Logger, () => ({ level: 'info' }))
    ioc.register(Server, (r) => `Server on ${r(Config).port} [${r(Logger).level}]`)

    expect(ioc.resolve(Server)).toBe('Server on 3000 [info]')
  })
})
