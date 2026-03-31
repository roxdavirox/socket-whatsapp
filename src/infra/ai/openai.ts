import OpenAI from 'openai'
import { tryCatchAsync } from '@tecnomancy/alchemy'
import type { AIProvider, AIPrompt } from '../../domain/ports/ai-provider.js'

export const createOpenAIProvider = (apiKey: string): AIProvider => {
  const client = new OpenAI({ apiKey })

  return {
    analyze: (prompt: AIPrompt) =>
      tryCatchAsync(async (p: AIPrompt) => {
        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: p.system },
            { role: 'user', content: p.user },
          ],
          max_tokens: p.maxTokens ?? 500,
          temperature: 0.3,
        })
        return response.choices[0]?.message?.content ?? ''
      })(prompt),
  }
}
