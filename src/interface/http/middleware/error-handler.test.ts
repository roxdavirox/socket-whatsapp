import { describe, it, expect, vi } from 'vitest'
import { Ok, Err } from '@tecnomancy/alchemy'
import { resultToResponse } from './error-handler.js'

const mkRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
  return res as unknown as import('express').Response
}

describe('resultToResponse', () => {
  it('responds 200 with data on Ok', () => {
    const res = mkRes()
    resultToResponse(res, Ok({ id: '1' }))
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ data: { id: '1' } })
  })

  it('responds custom status on Ok', () => {
    const res = mkRes()
    resultToResponse(res, Ok('created'), 201)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('responds 404 on not found error', () => {
    const res = mkRes()
    resultToResponse(res, Err(new Error('Resource not found')))
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('responds 400 on Invalid error', () => {
    const res = mkRes()
    resultToResponse(res, Err(new Error('Invalid input')))
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('responds 401 on credentials error', () => {
    const res = mkRes()
    resultToResponse(res, Err(new Error('Invalid credentials')))
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('responds 500 on unknown error', () => {
    const res = mkRes()
    resultToResponse(res, Err(new Error('Something broke')))
    expect(res.status).toHaveBeenCalledWith(500)
  })
})
