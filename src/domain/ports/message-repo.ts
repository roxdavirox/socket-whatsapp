import type { Result, Option } from '@tecnomancy/alchemy'
import type { Message, CreateMessage } from '../entities/message.js'

export type MessageRepo = {
  readonly getById: (id: string) => Promise<Result<Option<Message>, Error>>
  readonly getByChatId: (chatId: string, limit?: number) => Promise<Result<Message[], Error>>
  readonly getByContact: (contactId: string, ownerId: string, limit?: number) => Promise<Result<Message[], Error>>
  readonly add: (message: CreateMessage) => Promise<Result<string, Error>>
}
