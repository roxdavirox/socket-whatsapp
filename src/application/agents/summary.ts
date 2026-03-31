import { Ok, isOk, tryCatchAsync } from '@tecnomancy/alchemy'
import type { Agent } from './types.js'
import type { AIProvider } from '../../domain/ports/ai-provider.js'

const SUMMARY_THRESHOLD = 20

export const createSummaryAgent = (ai: AIProvider): Agent =>
  async (ctx) => {
    if (ctx.history.length < SUMMARY_THRESHOLD) {
      return Ok({ type: 'pass' as const, context: ctx })
    }

    const historyText = ctx.history
      .map(m => `${m.direction === 'incoming' ? 'User' : 'Bot'}: ${m.text ?? '[media]'}`)
      .join('\n')

    const summary = await tryCatchAsync(async (h: string) =>
      ai.analyze({
        system: 'Summarize this WhatsApp conversation in 2-3 sentences. Focus on key topics, requests, and outcomes.',
        user: h,
        maxTokens: 150,
      })
    )(historyText)

    return Ok({
      type: 'pass' as const,
      context: {
        ...ctx,
        metadata: {
          ...ctx.metadata,
          summary: isOk(summary) ? summary.value : null,
        },
      },
    })
  }
