import type { Result, Option } from '@tecnomancy/alchemy'
import type { Session, SessionStatus } from '../entities/session.js'

export type SessionStore = {
  readonly get: (ownerId: string) => Promise<Result<Option<Session>, Error>>
  readonly getAll: () => Promise<Result<Session[], Error>>
  readonly save: (session: Session) => Promise<Result<void, Error>>
  readonly updateStatus: (ownerId: string, status: SessionStatus) => Promise<Result<void, Error>>
  readonly remove: (ownerId: string) => Promise<Result<void, Error>>
}
