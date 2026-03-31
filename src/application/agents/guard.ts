import { Ok, isOk, tryCatchAsync } from '@tecnomancy/alchemy'
import type { Agent } from './types.js'
import type { AIProvider } from '../../domain/ports/ai-provider.js'

const SPAM_PATTERNS = [
  /bit\.ly\/\w+/i,
  /ganhe.*dinheiro/i,
  /click.*link.*below/i,
  /free.*money/i,
  /wa\.me\/\d+.*promo/i,
]

const matchesAny = (patterns: readonly RegExp[]) => (text: string) =>
  patterns.some(p => p.test(text))

const isSpam = matchesAny(SPAM_PATTERNS)

export const createGuardAgent = (ai: AIProvider): Agent =>
  async (ctx) => {
    const text = ctx.message.text
    if (!text) return Ok({ type: 'pass' as const, context: ctx })

    if (isSpam(text)) return Ok({ type: 'block' as const, reason: 'spam_pattern' })

    const analysis = await tryCatchAsync(async (t: string) =>
      ai.analyze({
        system: 'Classify this message as exactly one of: safe, spam, sensitive. Respond with JSON: {"classification":"...","confidence":0.0}',
        user: t,
        maxTokens: 50,
      })
    )(text)

    return Ok({
      type: 'pass' as const,
      context: {
        ...ctx,
        metadata: {
          ...ctx.metadata,
          guard: isOk(analysis) ? analysis.value : null,
        },
      },
    })
  }
