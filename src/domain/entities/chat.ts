export type ChatStatus = 'open' | 'closed' | 'pending'

export type Chat = {
  readonly id: string
  readonly contactId: string
  readonly ownerId: string
  readonly status: ChatStatus
  readonly lastMessageAt: Date | null
  readonly createdAt: Date
  readonly closedAt: Date | null
}

export type CreateChat = Omit<Chat, 'id' | 'createdAt' | 'closedAt'> & {
  readonly closedAt?: Date
}
