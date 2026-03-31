import type { Result, Option } from '@tecnomancy/alchemy'
import type { Chat, CreateChat } from '../entities/chat.js'

export type ChatRepo = {
  readonly getById: (id: string) => Promise<Result<Option<Chat>, Error>>
  readonly getByContactId: (contactId: string) => Promise<Result<Option<Chat>, Error>>
  readonly getByOwner: (ownerId: string) => Promise<Result<Chat[], Error>>
  readonly add: (chat: CreateChat) => Promise<Result<string, Error>>
  readonly updateStatus: (id: string, status: Chat['status']) => Promise<Result<void, Error>>
  readonly close: (id: string) => Promise<Result<void, Error>>
}
