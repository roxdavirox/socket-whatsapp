import type { Result } from '@tecnomancy/alchemy'
import type { Jid } from '../value-objects/jid.js'

export type WAClient = {
  readonly sendText: (jid: Jid, text: string) => Promise<Result<string, Error>>
  readonly sendMedia: (jid: Jid, buffer: Buffer, mimetype: string, filename?: string) => Promise<Result<string, Error>>
  readonly getProfilePicture: (jid: Jid) => Promise<Result<string | null, Error>>
  readonly close: () => Promise<Result<void, Error>>
}
