import { tryCatchAsync, type Result } from '@tecnomancy/alchemy'
import type { AuthResult, Chat, Contact, Message } from '../types.js'

type ApiResponse<T> = { data: T }

const safeFetch = <T>(url: string, options: RequestInit = {}) =>
  tryCatchAsync(async (u: string, opts: RequestInit) => {
    const res = await fetch(u, opts)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${body}`)
    }
    const json = await res.json() as ApiResponse<T>
    return json.data
  })(url, options)

export const login = (apiUrl: string, email: string, password: string): Promise<Result<AuthResult, Error>> =>
  safeFetch<AuthResult>(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

export const fetchChats = (apiUrl: string, headers: Record<string, string>): Promise<Result<Chat[], Error>> =>
  safeFetch<Chat[]>(`${apiUrl}/api/chats`, { headers })

export const fetchContacts = (apiUrl: string, headers: Record<string, string>): Promise<Result<Contact[], Error>> =>
  safeFetch<Contact[]>(`${apiUrl}/api/contacts`, { headers })

export const fetchMessages = (
  apiUrl: string,
  headers: Record<string, string>,
  chatId: string,
  limit = 50,
): Promise<Result<Message[], Error>> =>
  safeFetch<Message[]>(`${apiUrl}/api/chats/${chatId}/messages?limit=${limit}`, { headers })
