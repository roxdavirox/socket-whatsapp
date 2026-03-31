export type UserRole = 'admin' | 'operator'

export type User = {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly role: UserRole
  readonly passwordHash: string
  readonly active: boolean
  readonly createdAt: Date
}

export type CreateUser = Omit<User, 'id' | 'createdAt'>
