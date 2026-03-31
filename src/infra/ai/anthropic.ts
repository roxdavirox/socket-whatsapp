import Anthropic from '@anthropic-ai/sdk'
import { tryCatchAsync } from '@tecnomancy/alchemy'
import type { AIProvider, AIPrompt } from '../../domain/ports/ai-provider.js'

export const createAnthropicProvider = (apiKey: string): AIProvider => {
  const client = new Anthropic({ apiKey })

  return {
    analyze: (prompt: AIPrompt) =>
      tryCatchAsync(async (p: AIPrompt) => {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          system: p.system,
          messages: [{ role: 'user', content: p.user }],
          max_tokens: p.maxTokens ?? 500,
        })
        const block = response.content[0]
        return block?.type === 'text' ? block.text : ''
      })(prompt),
  }
}
