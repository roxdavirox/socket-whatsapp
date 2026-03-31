import { isOk, Ok, Err, type Result } from '@tecnomancy/alchemy'
import { createContainer as createIoC, type Container } from './ioc.js'
import { Tokens } from './tokens.js'
import type { Env } from './env.js'
import { createLogger } from './logger.js'
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
import { createEventBus } from '../application/event-bus.js'
import { createSessionManager } from '../application/services/session-manager.js'
import { createAuthenticate } from '../application/use-cases/authenticate.js'
import { createManageSession } from '../application/use-cases/manage-session.js'
import { createHandleIncomingMessage } from '../application/use-cases/handle-incoming-message.js'
import { createSendMessage } from '../application/use-cases/send-message.js'
import { createSendMedia } from '../application/use-cases/send-media.js'
import { createSymphonyOrchestrator } from '../infra/symphony/orchestrator.js'
import type { AIProvider } from '../domain/ports/ai-provider.js'
import type { FileStorage } from '../domain/ports/file-storage.js'

// --- Dependencies facade (preserves existing consumer API) ---

export type Dependencies = {
  readonly env: Env
  readonly logger: ReturnType<typeof createLogger>
  readonly db: DrizzleClient
  readonly eventBus: ReturnType<typeof createEventBus>
  readonly userRepo: ReturnType<typeof createUserRepo>
  readonly contactRepo: ReturnType<typeof createContactRepo>
  readonly chatRepo: ReturnType<typeof createChatRepo>
  readonly messageRepo: ReturnType<typeof createMessageRepo>
  readonly sessionStore: ReturnType<typeof createSessionStore>
  readonly fileStorage: FileStorage
  readonly ai: AIProvider
  readonly sessionManager: ReturnType<typeof createSessionManager>
  readonly authenticate: ReturnType<typeof createAuthenticate>
  readonly manageSession: ReturnType<typeof createManageSession>
  readonly handleIncomingMessage: (raw: unknown, ownerId: string) => Promise<void>
  readonly sendMessage: ReturnType<typeof createSendMessage>
  readonly sendMedia: ReturnType<typeof createSendMedia>
  readonly symphony: ReturnType<typeof createSymphonyOrchestrator> | null
  readonly container: Container
}

// --- resolvers (pure functions, no side effects) ---

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

const resolveStorage = (env: Env): FileStorage =>
  env.AZURE_STORAGE_ACCOUNT_NAME && env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY
    ? createAzureStorage({
        accountName: env.AZURE_STORAGE_ACCOUNT_NAME,
        accountKey: env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY,
        containerName: env.AZURE_STORAGE_CONTAINER,
      })
    : createLocalStorage(env.LOCAL_STORAGE_DIR)

const resolveSymphony = (env: Env, ai: AIProvider, logger: ReturnType<typeof createLogger>) => {
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

// --- IoC registration ---

const registerCore = (ioc: Container, env: Env, db: DrizzleClient) => {
  ioc.register(Tokens.Env, () => env)
  ioc.register(Tokens.Logger, (r) => createLogger(r(Tokens.Env)))
  ioc.register(Tokens.Db, () => db)
  ioc.register(Tokens.EventBus, () => createEventBus())
}

const registerRepos = (ioc: Container) => {
  ioc.register(Tokens.UserRepo, (r) => createUserRepo(r(Tokens.Db)))
  ioc.register(Tokens.ContactRepo, (r) => createContactRepo(r(Tokens.Db)))
  ioc.register(Tokens.ChatRepo, (r) => createChatRepo(r(Tokens.Db)))
  ioc.register(Tokens.MessageRepo, (r) => createMessageRepo(r(Tokens.Db)))
  ioc.register(Tokens.SessionStore, (r) => createSessionStore(r(Tokens.Db)))
}

const registerInfra = (ioc: Container) => {
  ioc.register(Tokens.FileStorage, (r) => resolveStorage(r(Tokens.Env)))
  ioc.register(Tokens.AI, (r) => resolveAI(r(Tokens.Env)))
  ioc.register(Tokens.Symphony, (r) => resolveSymphony(r(Tokens.Env), r(Tokens.AI), r(Tokens.Logger)))
}

const registerServices = (ioc: Container) => {
  ioc.register(Tokens.SessionManager, (r) =>
    createSessionManager(r(Tokens.SessionStore), r(Tokens.EventBus), r(Tokens.Logger)),
  )
}

const registerUseCases = (ioc: Container, toDeps: () => Dependencies) => {
  ioc.register(Tokens.Authenticate, () => createAuthenticate(toDeps()))
  ioc.register(Tokens.ManageSession, () => createManageSession(toDeps()))
  ioc.register(Tokens.HandleIncomingMessage, () => createHandleIncomingMessage(toDeps()))
  ioc.register(Tokens.SendMessage, () => createSendMessage(toDeps()))
  ioc.register(Tokens.SendMedia, () => createSendMedia(toDeps()))
}

// --- facade: builds Dependencies from IoC ---

const buildFacade = (ioc: Container): Dependencies => {
  const facade: Dependencies = Object.create(null)
  const toDeps = () => facade

  registerUseCases(ioc, toDeps)

  const entries: [string, symbol][] = [
    ['env', Tokens.Env],
    ['logger', Tokens.Logger],
    ['db', Tokens.Db],
    ['eventBus', Tokens.EventBus],
    ['userRepo', Tokens.UserRepo],
    ['contactRepo', Tokens.ContactRepo],
    ['chatRepo', Tokens.ChatRepo],
    ['messageRepo', Tokens.MessageRepo],
    ['sessionStore', Tokens.SessionStore],
    ['fileStorage', Tokens.FileStorage],
    ['ai', Tokens.AI],
    ['sessionManager', Tokens.SessionManager],
    ['authenticate', Tokens.Authenticate],
    ['manageSession', Tokens.ManageSession],
    ['handleIncomingMessage', Tokens.HandleIncomingMessage],
    ['sendMessage', Tokens.SendMessage],
    ['sendMedia', Tokens.SendMedia],
    ['symphony', Tokens.Symphony],
  ]

  const tokenProps = Object.fromEntries(
    entries.map(([key, token]) => [
      key,
      { get: () => ioc.resolve(token as never), enumerable: true },
    ]),
  )

  Object.defineProperties(facade, {
    ...tokenProps,
    container: { value: ioc, enumerable: false },
  })
  return facade
}

// --- public API ---

export const createContainer = (env: Env): Result<Dependencies, Error> => {
  const dbResult = createDbClient(env.DATABASE_URL)
  if (!isOk(dbResult)) return Err(dbResult.error)

  const ioc = createIoC()

  registerCore(ioc, env, dbResult.value.db)
  registerRepos(ioc)
  registerInfra(ioc)
  registerServices(ioc)

  return Ok(buildFacade(ioc))
}
