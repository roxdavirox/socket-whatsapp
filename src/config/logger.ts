import pino from 'pino'
import type { Env } from './env.js'

export type Logger = pino.Logger

export const createLogger = (env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): Logger =>
  pino({
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  })
