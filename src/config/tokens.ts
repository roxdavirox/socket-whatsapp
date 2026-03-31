import { createToken } from './ioc.js'
import type { Env } from './env.js'
import type { Logger } from './logger.js'
import type { DrizzleClient } from '../infra/db/client.js'
import type { EventBus } from '../application/event-bus.js'
import type { SessionManager } from '../application/services/session-manager.js'
import type { Authenticate } from '../application/use-cases/authenticate.js'
import type { ManageSession } from '../application/use-cases/manage-session.js'
import type { UserRepo } from '../domain/ports/user-repo.js'
import type { ContactRepo } from '../domain/ports/contact-repo.js'
import type { ChatRepo } from '../domain/ports/chat-repo.js'
import type { MessageRepo } from '../domain/ports/message-repo.js'
import type { SessionStore } from '../domain/ports/session-store.js'
import type { FileStorage } from '../domain/ports/file-storage.js'
import type { AIProvider } from '../domain/ports/ai-provider.js'
import type { SymphonyOrchestrator } from '../infra/symphony/orchestrator.js'
import type { createSendMessage } from '../application/use-cases/send-message.js'
import type { createSendMedia } from '../application/use-cases/send-media.js'

export const Tokens = {
  Env: createToken<Env>('Env'),
  Logger: createToken<Logger>('Logger'),
  Db: createToken<DrizzleClient>('Db'),
  EventBus: createToken<EventBus>('EventBus'),

  UserRepo: createToken<UserRepo>('UserRepo'),
  ContactRepo: createToken<ContactRepo>('ContactRepo'),
  ChatRepo: createToken<ChatRepo>('ChatRepo'),
  MessageRepo: createToken<MessageRepo>('MessageRepo'),
  SessionStore: createToken<SessionStore>('SessionStore'),
  FileStorage: createToken<FileStorage>('FileStorage'),
  AI: createToken<AIProvider>('AI'),

  SessionManager: createToken<SessionManager>('SessionManager'),
  Authenticate: createToken<Authenticate>('Authenticate'),
  ManageSession: createToken<ManageSession>('ManageSession'),
  HandleIncomingMessage: createToken<(raw: unknown, ownerId: string) => Promise<void>>('HandleIncomingMessage'),
  SendMessage: createToken<ReturnType<typeof createSendMessage>>('SendMessage'),
  SendMedia: createToken<ReturnType<typeof createSendMedia>>('SendMedia'),
  Symphony: createToken<SymphonyOrchestrator | null>('Symphony'),
} as const
