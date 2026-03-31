import { tryCatchAsync } from '@tecnomancy/alchemy'
import type { AIProvider, AIPrompt } from '../../domain/ports/ai-provider.js'

export const createOllamaProvider = (baseUrl: string): AIProvider => ({
  analyze: (prompt: AIPrompt) =>
    tryCatchAsync(async (p: AIPrompt) => {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          messages: [
            { role: 'system', content: p.system },
            { role: 'user', content: p.user },
          ],
          stream: false,
        }),
      })
      const data = await response.json() as { message?: { content?: string } }
      return data.message?.content ?? ''
    })(prompt),
})
