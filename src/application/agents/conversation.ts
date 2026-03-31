import { Ok, isOk, tryCatchAsync, tryCatch, pipe, fromNullable, flatMapOption, Some, None, toNullable } from '@tecnomancy/alchemy'
import type { Agent } from './types.js'
import type { AIProvider } from '../../domain/ports/ai-provider.js'
import { formatHistory } from './shared.js'

const trySafeJsonParse = (str: string): Record<string, unknown> | null =>
  pipe(
    fromNullable(str.match(/\{[\s\S]*\}/)?.[0]),
    flatMapOption((json: string) => {
      const parsed = tryCatch(() => JSON.parse(json) as Record<string, unknown>)()
      return isOk(parsed) ? Some(parsed.value) : None
    }),
    toNullable,
  )

const extractAutoReply = (parsed: Record<string, unknown> | null) =>
  parsed?.shouldAutoReply && parsed.suggestedReply
    ? { shouldReply: true as const, text: String(parsed.suggestedReply), parsed }
    : { shouldReply: false as const, parsed }

export const createConversationAgent = (ai: AIProvider): Agent =>
  async (ctx) => {
    const text = ctx.message.text
    if (!text) return Ok({ type: 'pass' as const, context: ctx })

    const historyText = formatHistory(ctx.history)

    const analysis = await tryCatchAsync(async (t: string, h: string) =>
      ai.analyze({
        system: [
          'You are a WhatsApp assistant analyzing conversation intent.',
          'Given the conversation history and latest message, respond with JSON:',
          '{"intent":"greeting|question|complaint|info_request|other","shouldAutoReply":boolean,"suggestedReply":"..."}',
          'Only set shouldAutoReply=true for simple greetings or FAQs.',
        ].join('\n'),
        user: `History:\n${h}\n\nLatest: ${t}`,
        maxTokens: 200,
      })
    )(text, historyText)

    const inner = isOk(analysis) && isOk(analysis.value) ? analysis.value.value : null
    const reply = extractAutoReply(inner ? trySafeJsonParse(inner) : null)

    if (reply.shouldReply) {
      return Ok({
        type: 'respond' as const,
        text: reply.text,
        context: { ...ctx, metadata: { ...ctx.metadata, conversation: reply.parsed } },
      })
    }

    return Ok({
      type: 'pass' as const,
      context: {
        ...ctx,
        metadata: {
          ...ctx.metadata,
          conversation: isOk(analysis) ? analysis.value : null,
        },
      },
    })
  }
