import { tryCatchAsync, isOk, Ok, Err, pipe, type Result } from '@tecnomancy/alchemy'
import type { AgentRunnerLike, AgentRunResult, AgentRunnerEvent } from 'symphony-ts'
import { type Issue, type Workspace, type RunAttempt, createEmptyLiveSession } from 'symphony-ts'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { AIProvider } from '../../domain/ports/ai-provider.js'
import type { Logger } from '../../config/logger.js'

const execAsync = promisify(exec)

type AgentRunnerConfig = {
  readonly workspaceRoot: string
  readonly repoUrl: string
}

type AgentRunnerDeps = {
  readonly config: AgentRunnerConfig
  readonly ai: AIProvider
  readonly logger: Logger
  readonly onEvent?: (event: AgentRunnerEvent) => void
}

// --- tacit helpers ---

const sanitizeKey = (identifier: string) =>
  identifier.replace(/[^a-zA-Z0-9-]/g, '-')

const toWorkspacePath = (root: string) => (key: string) =>
  `${root}/${key}`

const mkEvent = (
  base: Pick<AgentRunnerEvent, 'issueId' | 'issueIdentifier' | 'attempt' | 'workspacePath' | 'turnCount'>,
) => (event: AgentRunnerEvent['event']): AgentRunnerEvent => ({
  ...base,
  event,
  timestamp: new Date().toISOString(),
  codexAppServerPid: null,
})

const buildPrompt = (issue: Issue): string => [
  `You are implementing ${issue.identifier}: ${issue.title}`,
  '',
  issue.description ?? 'No description provided.',
  '',
  `Labels: ${issue.labels.join(', ') || 'none'}`,
  '',
  'Rules:',
  '- Zero classes, only functions and closures',
  '- Use @tecnomancy/alchemy: Result, Option, pipe, tryCatchAsync',
  '- No try/catch, no throw',
  '- Tacit/point-free style where possible',
  '- Run `npx tsc --noEmit` before finishing',
  '- Commit messages in Portuguese',
].join('\n')

const toRunAttempt = (issue: Issue, workspace: Workspace, attempt: number | null): RunAttempt => ({
  issueId: issue.id,
  issueIdentifier: issue.identifier,
  attempt,
  workspacePath: workspace.path,
  startedAt: new Date().toISOString(),
  status: 'preparing_workspace',
})

// --- workspace ---

const prepareWorkspace = (root: string) => (issue: Issue) =>
  tryCatchAsync(async (iss: Issue) => {
    const key = sanitizeKey(iss.identifier)
    const path = pipe(key, toWorkspacePath(root))
    await execAsync(`mkdir -p ${path}`)
    return { path, workspaceKey: key, createdNow: true } satisfies Workspace
  })(issue)

// --- anthropic agent execution ---

const runAnthropicAgent = (ai: AIProvider, logger: Logger) => (workspace: Workspace, prompt: string) =>
  tryCatchAsync(async (_ws: Workspace, p: string) => {
    logger.info({ cwd: _ws.path }, 'Running Anthropic agent')

    const systemPrompt = [
      'You are a senior TypeScript developer. Implement the requested changes.',
      'Output ONLY the file changes as unified diff format.',
      'Do not explain — just output the diffs.',
    ].join('\n')

    const result = await ai.analyze({
      system: systemPrompt,
      user: p,
      maxTokens: 4096,
    })

    return isOk(result) ? result.value : ''
  })(workspace, prompt)

// --- runner factory ---

export const createAnthropicAgentRunner = (deps: AgentRunnerDeps): AgentRunnerLike => ({
  run: async ({ issue, attempt, signal: _signal }) => {
    const { config, ai, logger, onEvent } = deps

    const workspace = await pipe(issue, prepareWorkspace(config.workspaceRoot))
    if (!isOk(workspace)) throw new Error(`Workspace failed: ${workspace.error.message}`)

    const runAttempt = toRunAttempt(issue, workspace.value, attempt)
    const eventBase = {
      issueId: issue.id,
      issueIdentifier: issue.identifier,
      attempt,
      workspacePath: workspace.value.path,
      turnCount: 0,
    }
    const emit = mkEvent(eventBase)

    onEvent?.(emit('session_started'))

    const prompt = buildPrompt(issue)
    const result = await runAnthropicAgent(ai, logger)(workspace.value, prompt)

    const succeeded = isOk(result)
    onEvent?.(mkEvent({ ...eventBase, turnCount: 1 })(
      succeeded ? 'turn_completed' : 'turn_failed',
    ))

    return {
      issue,
      workspace: workspace.value,
      runAttempt: { ...runAttempt, status: succeeded ? 'succeeded' as const : 'failed' as const },
      liveSession: createEmptyLiveSession(),
      turnsCompleted: succeeded ? 1 : 0,
      lastTurn: null,
      rateLimits: null,
    } satisfies AgentRunResult
  },
})

export const createAgentRunner = (deps: AgentRunnerDeps): Result<AgentRunnerLike, Error> =>
  pipe(
    deps.config,
    (cfg) => !cfg.workspaceRoot ? Err(new Error('workspaceRoot is required') as Error)
      : !cfg.repoUrl ? Err(new Error('repoUrl is required') as Error)
      : Ok(createAnthropicAgentRunner(deps)),
  )
