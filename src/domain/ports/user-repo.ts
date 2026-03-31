import type { Result, Option } from '@tecnomancy/alchemy'
import type { User, CreateUser } from '../entities/user.js'

export type UserRepo = {
  readonly getById: (id: string) => Promise<Result<Option<User>, Error>>
  readonly getByEmail: (email: string) => Promise<Result<Option<User>, Error>>
  readonly getAll: () => Promise<Result<User[], Error>>
  readonly getOperators: () => Promise<Result<User[], Error>>
  readonly add: (user: CreateUser) => Promise<Result<string, Error>>
  readonly update: (id: string, data: Partial<Pick<User, 'name' | 'role' | 'active'>>) => Promise<Result<void, Error>>
}
