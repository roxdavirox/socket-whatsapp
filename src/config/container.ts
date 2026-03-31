import { isOk, Ok, Err, type Result } from '@tecnomancy/alchemy'
import type { Env } from './env.js'
import { createLogger, type Logger } from './logger.js'
import { createDbClient, type DrizzleClient } from '../infra/db/client.js'
import { createUserRepo } from '../infra/db/repos/user-repo.js'
import { createContactRepo } from '../infra/db/repos/contact-repo.js'
import { createChatRepo } from '../infra/db/repos/chat-repo.js'
import { createMessageRepo } from '../infra/db/repos/message-repo.js'
import { createSessionStore } from '../infra/db/repos/session-store.js'
import { createLocalStorage } from '../infra/storage/local-fs.js'
import { createAzureStorage } from '../infra/storage/azure-blob.js'
import { createOpenAIProvider } from '../infra/ai/openai.js'
import { createAnthropicProvider } from '../infra/ai/anthropic.js'
import { createOllamaProvider } from '../infra/ai/ollama.js'
import { createEventBus, type EventBus } from '../application/event-bus.js'
import { createSessionManager, type SessionManager } from '../application/services/session-manager.js'
import { createAuthenticate, type Authenticate } from '../application/use-cases/authenticate.js'
import { createManageSession, type ManageSession } from '../application/use-cases/manage-session.js'
import { createHandleIncomingMessage } from '../application/use-cases/handle-incoming-message.js'
import { createSendMessage } from '../application/use-cases/send-message.js'
import { createSendMedia } from '../application/use-cases/send-media.js'
import { createSymphonyOrchestrator, type SymphonyOrchestrator } from '../infra/symphony/orchestrator.js'
import type { UserRepo } from '../domain/ports/user-repo.js'
import type { ContactRepo } from '../domain/ports/contact-repo.js'
import type { ChatRepo } from '../domain/ports/chat-repo.js'
import type { MessageRepo } from '../domain/ports/message-repo.js'
import type { SessionStore } from '../domain/ports/session-store.js'
import type { FileStorage } from '../domain/ports/file-storage.js'
import type { AIProvider } from '../domain/ports/ai-provider.js'

export type Dependencies = {
  readonly env: Env
  readonly logger: Logger
  readonly db: DrizzleClient
  readonly eventBus: EventBus
  readonly userRepo: UserRepo
  readonly contactRepo: ContactRepo
  readonly chatRepo: ChatRepo
  readonly messageRepo: MessageRepo
  readonly sessionStore: SessionStore
  readonly fileStorage: FileStorage
  readonly ai: AIProvider
  readonly sessionManager: SessionManager
  readonly authenticate: Authenticate
  readonly manageSession: ManageSession
  readonly handleIncomingMessage: (raw: unknown, ownerId: string) => Promise<void>
  readonly sendMessage: ReturnType<typeof createSendMessage>
  readonly sendMedia: ReturnType<typeof createSendMedia>
  readonly symphony: SymphonyOrchestrator | null
}

const noopAI: AIProvider = {
  analyze: async () => Ok('{"classification":"safe","confidence":1}'),
}

const resolveAI = (env: Env): AIProvider => {
  switch (env.AI_PROVIDER) {
    case 'openai': return env.OPENAI_API_KEY ? createOpenAIProvider(env.OPENAI_API_KEY) : noopAI
    case 'anthropic': return env.ANTHROPIC_API_KEY ? createAnthropicProvider(env.ANTHROPIC_API_KEY) : noopAI
    case 'ollama': return createOllamaProvider(env.OLLAMA_URL)
    case 'none': return noopAI
  }
}

const resolveSymphony = (env: Env, ai: AIProvider, logger: Logger): SymphonyOrchestrator | null => {
  if (!env.SYMPHONY_ENABLED || !env.SYMPHONY_GITHUB_OWNER || !env.SYMPHONY_GITHUB_REPO || !env.SYMPHONY_GITHUB_TOKEN) {
    return null
  }
  return createSymphonyOrchestrator({
    workflowPath: env.SYMPHONY_WORKFLOW_PATH,
    github: {
      owner: env.SYMPHONY_GITHUB_OWNER,
      repo: env.SYMPHONY_GITHUB_REPO,
      token: env.SYMPHONY_GITHUB_TOKEN,
      activeLabels: env.SYMPHONY_GITHUB_LABELS?.split(',').map(l => l.trim()),
    },
    workspace: { root: env.SYMPHONY_WORKSPACE_ROOT },
    maxConcurrentAgents: env.SYMPHONY_MAX_AGENTS,
    pollIntervalMs: env.SYMPHONY_POLL_INTERVAL_MS,
    port: env.SYMPHONY_DASHBOARD_PORT,
  }, ai, logger)
}

const resolveStorage = (env: Env): FileStorage => {
  if (env.AZURE_STORAGE_ACCOUNT_NAME && env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY) {
    return createAzureStorage({
      accountName: env.AZURE_STORAGE_ACCOUNT_NAME,
      accountKey: env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY,
      containerName: env.AZURE_STORAGE_CONTAINER,
    })
  }
  return createLocalStorage(env.LOCAL_STORAGE_DIR)
}

export const createContainer = (env: Env): Result<Dependencies, Error> => {
  const logger = createLogger(env)
  const dbResult = createDbClient(env.DATABASE_URL)
  if (!isOk(dbResult)) return Err(dbResult.error)

  const { db } = dbResult.value
  const eventBus = createEventBus()

  const userRepo = createUserRepo(db)
  const contactRepo = createContactRepo(db)
  const chatRepo = createChatRepo(db)
  const messageRepo = createMessageRepo(db)
  const sessionStore = createSessionStore(db)
  const fileStorage = resolveStorage(env)
  const ai = resolveAI(env)

  const lazy = <T>(init: () => T): (() => T) => {
    let cached: T | undefined
    return () => (cached ??= init())
  }

  const deps: Dependencies = Object.create(null)
  const self = () => deps

  Object.assign(deps, {
    env, logger, db, eventBus,
    userRepo, contactRepo, chatRepo, messageRepo,
    sessionStore, fileStorage, ai,
    sessionManager: createSessionManager(sessionStore, eventBus, logger),
    symphony: resolveSymphony(env, ai, logger),
  })

  const lazyAuthenticate = lazy(() => createAuthenticate(self()))
  const lazyManageSession = lazy(() => createManageSession(self()))
  const lazyHandleIncoming = lazy(() => createHandleIncomingMessage(self()))
  const lazySendMessage = lazy(() => createSendMessage(self()))
  const lazySendMedia = lazy(() => createSendMedia(self()))

  Object.defineProperties(deps, {
    authenticate: { get: lazyAuthenticate, enumerable: true },
    manageSession: { get: lazyManageSession, enumerable: true },
    handleIncomingMessage: { get: lazyHandleIncoming, enumerable: true },
    sendMessage: { get: lazySendMessage, enumerable: true },
    sendMedia: { get: lazySendMedia, enumerable: true },
  })

  return Ok(deps)
}
