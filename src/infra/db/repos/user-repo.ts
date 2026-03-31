import { eq } from 'drizzle-orm'
import { tryCatchAsync, fromNullable } from '@tecnomancy/alchemy'
import { users } from '../schema.js'
import type { DrizzleClient } from '../client.js'
import type { UserRepo } from '../../../domain/ports/user-repo.js'
import type { User } from '../../../domain/entities/user.js'

export const createUserRepo = (db: DrizzleClient): UserRepo => ({
  getById: (id) =>
    tryCatchAsync(async (i: string) => {
      const rows = await db.select().from(users).where(eq(users.id, i)).limit(1)
      return fromNullable(rows[0] as User | undefined)
    })(id),

  getByEmail: (email) =>
    tryCatchAsync(async (e: string) => {
      const rows = await db.select().from(users).where(eq(users.email, e)).limit(1)
      return fromNullable(rows[0] as User | undefined)
    })(email),

  getAll: () =>
    tryCatchAsync(async () =>
      await db.select().from(users) as User[]
    )(),

  getOperators: () =>
    tryCatchAsync(async () =>
      await db.select().from(users).where(eq(users.role, 'operator')) as User[]
    )(),

  add: (user) =>
    tryCatchAsync(async (u: typeof user) => {
      const [row] = await db.insert(users).values(u).returning({ id: users.id })
      return row!.id
    })(user),

  update: (id, data) =>
    tryCatchAsync(async (i: string, d: typeof data) => {
      await db.update(users).set(d).where(eq(users.id, i))
    })(id, data),
})
