import type { Result } from '@tecnomancy/alchemy'
import type { Message } from '../../domain/entities/message.js'
import type { Contact } from '../../domain/entities/contact.js'

export type AgentContext = {
  readonly message: Message
  readonly contact: Contact
  readonly history: readonly Message[]
  readonly ownerId: string
  readonly metadata: Record<string, unknown>
}

export type AgentDecision =
  | { readonly type: 'pass'; readonly context: AgentContext }
  | { readonly type: 'respond'; readonly text: string; readonly context: AgentContext }
  | { readonly type: 'block'; readonly reason: string }
  | { readonly type: 'route'; readonly operatorId: string; readonly context: AgentContext }
  | { readonly type: 'escalate'; readonly reason: string; readonly context: AgentContext }

export type Agent = (ctx: AgentContext) => Promise<Result<AgentDecision, Error>>
