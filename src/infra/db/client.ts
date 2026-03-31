import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { tryCatch } from '@tecnomancy/alchemy'
import * as schema from './schema.js'

export type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>

export const createDbClient = (databaseUrl: string) =>
  tryCatch((url: string) => {
    const sql = postgres(url)
    return { db: drizzle(sql, { schema }), sql }
  })(databaseUrl)
