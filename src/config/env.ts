import { z } from 'zod'
import { Ok, Err, type Result } from '@tecnomancy/alchemy'

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  AZURE_STORAGE_ACCOUNT_NAME: z.string().optional(),
  AZURE_STORAGE_ACCOUNT_ACCESS_KEY: z.string().optional(),
  AZURE_STORAGE_CONTAINER: z.string().default('whatsapp-media'),

  LOCAL_STORAGE_DIR: z.string().default('./storage'),

  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OLLAMA_URL: z.string().default('http://localhost:11434'),

  AI_PROVIDER: z.enum(['openai', 'anthropic', 'ollama', 'none']).default('none'),

  WA_AUTH_DIR: z.string().default('./auth_sessions'),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  CORS_ORIGIN: z.string().default('*'),
})

export type Env = z.infer<typeof envSchema>

export const loadEnv = (): Result<Env, Error> => {
  const parsed = envSchema.safeParse(process.env)
  return parsed.success
    ? Ok(parsed.data)
    : Err(new Error(`Invalid env: ${parsed.error.flatten().fieldErrors}`))
}
