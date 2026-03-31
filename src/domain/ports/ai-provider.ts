import type { Result } from '@tecnomancy/alchemy'

export type AIPrompt = {
  readonly system: string
  readonly user: string
  readonly maxTokens?: number
}

export type AIProvider = {
  readonly analyze: (prompt: AIPrompt) => Promise<Result<string, Error>>
}
