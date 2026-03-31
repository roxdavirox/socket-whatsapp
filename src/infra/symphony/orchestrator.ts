import {
  OrchestratorRuntimeHost,
  startRuntimeService,
  resolveWorkflowConfig,
  loadWorkflowDefinition,
  type RuntimeServiceHandle,
  type ResolvedWorkflowConfig,
} from 'symphony-ts'
import { tryCatchAsync, pipe, type Result } from '@tecnomancy/alchemy'
import { createGitHubTracker } from './github-tracker.js'
import { createAnthropicAgentRunner } from './agent-runner.js'
import type { AIProvider } from '../../domain/ports/ai-provider.js'
import type { Logger } from '../../config/logger.js'

export type SymphonyConfig = {
  readonly workflowPath: string
  readonly github: {
    readonly owner: string
    readonly repo: string
    readonly token: string
    readonly activeLabels?: readonly string[]
  }
  readonly workspace: {
    readonly root: string
  }
  readonly maxConcurrentAgents?: number
  readonly pollIntervalMs?: number
  readonly port?: number
}

export type SymphonyOrchestrator = {
  readonly start: () => Promise<Result<RuntimeServiceHandle, Error>>
  readonly stop: () => Promise<void>
}

// --- tacit config builders ---

const withTracker = (kind: string) => (config: ResolvedWorkflowConfig) => ({
  ...config,
  tracker: { ...config.tracker, kind },
})

const withPolling = (intervalMs: number) => (config: ResolvedWorkflowConfig) => ({
  ...config,
  polling: { intervalMs },
})

const withAgent = (maxConcurrentAgents: number) => (config: ResolvedWorkflowConfig) => ({
  ...config,
  agent: { ...config.agent, maxConcurrentAgents },
})

const withServer = (port: number | null) => (config: ResolvedWorkflowConfig) => ({
  ...config,
  server: { port },
})

const buildConfig = (cfg: SymphonyConfig) => (base: ResolvedWorkflowConfig) =>
  pipe(
    base,
    withTracker('custom'),
    withPolling(cfg.pollIntervalMs ?? 30_000),
    withAgent(cfg.maxConcurrentAgents ?? 3),
    withServer(cfg.port ?? null),
  )

const logEvent = (logger: Logger) => (event: { event: string; issueIdentifier: string }) => {
  logger.info({ event: event.event, issue: event.issueIdentifier }, 'Symphony agent event')
}

export const createSymphonyOrchestrator = (
  symphonyConfig: SymphonyConfig,
  ai: AIProvider,
  logger: Logger,
): SymphonyOrchestrator => {
  let handle: RuntimeServiceHandle | null = null

  return {
    start: () =>
      tryCatchAsync(async (cfg: SymphonyConfig) => {
        const workflow = await loadWorkflowDefinition(cfg.workflowPath)
        const baseConfig = resolveWorkflowConfig({
          ...workflow,
          workflowPath: cfg.workflowPath,
        }) as ResolvedWorkflowConfig

        const config = buildConfig(cfg)(baseConfig)

        const tracker = createGitHubTracker({
          owner: cfg.github.owner,
          repo: cfg.github.repo,
          token: cfg.github.token,
          activeLabels: cfg.github.activeLabels as string[],
        })

        const agentRunner = createAnthropicAgentRunner({
          config: {
            workspaceRoot: cfg.workspace.root,
            repoUrl: `https://github.com/${cfg.github.owner}/${cfg.github.repo}.git`,
          },
          ai,
          logger,
          onEvent: logEvent(logger),
        })

        const service = await startRuntimeService({
          config,
          tracker,
          runtimeHost: new OrchestratorRuntimeHost({
            config,
            tracker,
            agentRunner,
          }),
        })

        handle = service
        logger.info('Symphony orchestrator started (Anthropic agent)')
        return service
      })(symphonyConfig),

    stop: async () => {
      if (!handle) return
      await handle.shutdown()
      handle = null
      logger.info('Symphony orchestrator stopped')
    },
  }
}
