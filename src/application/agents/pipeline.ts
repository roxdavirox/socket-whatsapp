import { Ok, isOk, type Result } from '@tecnomancy/alchemy'
import type { Agent, AgentContext, AgentDecision } from './types.js'
import type { Logger } from '../../config/logger.js'

export const createPipeline = (agents: readonly Agent[], logger: Logger): Agent =>
  async (ctx: AgentContext): Promise<Result<AgentDecision, Error>> => {
    const step = async (
      currentCtx: AgentContext,
      remaining: readonly Agent[]
    ): Promise<Result<AgentDecision, Error>> => {
      if (remaining.length === 0) return Ok({ type: 'pass' as const, context: currentCtx })

      const [agent, ...rest] = remaining
      if (!agent) return Ok({ type: 'pass' as const, context: currentCtx })
      const result = await agent(currentCtx)

      if (!isOk(result)) {
        logger.warn({ err: result.error }, 'Agent failed, skipping')
        return step(currentCtx, rest)
      }

      return result.value.type === 'pass'
        ? step(result.value.context, rest)
        : Ok(result.value)
    }

    return step(ctx, agents)
  }
