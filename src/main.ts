import 'dotenv/config'
import { createServer as createHttpServer } from 'node:http'
import { isOk } from '@tecnomancy/alchemy'
import { loadEnv } from './config/env.js'
import { createContainer } from './config/container.js'
import { createServer } from './interface/http/server.js'
import { createSocketServer } from './interface/ws/socket-server.js'

const env = loadEnv()
if (!isOk(env)) {
  console.error('Failed to load env:', env.error.message)
  process.exit(1)
}

const container = createContainer(env.value)
if (!isOk(container)) {
  console.error('Failed to create container:', container.error.message)
  process.exit(1)
}

const deps = container.value
const app = createServer(deps)
const httpServer = createHttpServer(app)
createSocketServer(httpServer, deps)

httpServer.listen(deps.env.PORT, () => {
  deps.logger.info({ port: deps.env.PORT }, 'Server started')
})

deps.manageSession.restoreAll()
  .then(() => deps.logger.info('Sessions restored'))
  .catch((err: unknown) => deps.logger.error({ err }, 'Failed to restore sessions'))

if (deps.symphony) {
  deps.symphony.start()
    .then((r) => isOk(r)
      ? deps.logger.info('Symphony orchestrator running')
      : deps.logger.error({ err: r.error }, 'Symphony failed to start'))
    .catch((err: unknown) => deps.logger.error({ err }, 'Symphony startup error'))
}

const chainAsync = <T>(fn: (x: T) => Promise<unknown>) =>
  (acc: Promise<void>, x: T): Promise<void> => acc.then(() => fn(x)).then(() => {})

const removeSession = (ownerId: string) => deps.sessionManager.remove(ownerId)

const shutdown = async () => {
  deps.logger.info('Shutting down...')
  if (deps.symphony) await deps.symphony.stop()
  const sessions = [...deps.sessionManager.getAll().keys()]
  await sessions.reduce(chainAsync(removeSession), Promise.resolve())
  httpServer.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
