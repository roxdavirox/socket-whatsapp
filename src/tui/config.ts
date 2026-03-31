import { z } from 'zod'
import { Ok, Err, type Result } from '@tecnomancy/alchemy'

const schema = z.object({
  API_URL: z.string().default('http://localhost:3000'),
  WS_URL: z.string().default('http://localhost:3000'),
  EMAIL: z.string().optional(),
  PASSWORD: z.string().optional(),
})

export type TuiConfig = z.infer<typeof schema>

export const loadTuiConfig = (): Result<TuiConfig, Error> => {
  const parsed = schema.safeParse(process.env)
  return parsed.success
    ? Ok(parsed.data)
    : Err(new Error(`Invalid TUI config: ${parsed.error.message}`))
}
