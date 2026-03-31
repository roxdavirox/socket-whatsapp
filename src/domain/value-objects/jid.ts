import { Ok, Err, type Result } from '@tecnomancy/alchemy'

declare const JidBrand: unique symbol
export type Jid = string & { readonly [JidBrand]: typeof JidBrand }

const JID_PATTERN = /^\d+@(s\.whatsapp\.net|g\.us)$/

export const parseJid = (raw: string): Result<Jid, Error> =>
  JID_PATTERN.test(raw)
    ? Ok(raw as Jid)
    : Err(new Error(`Invalid JID: ${raw}`))

export const isGroupJid = (jid: Jid): boolean => jid.endsWith('@g.us')

export const jidToPhone = (jid: Jid): string => jid.split('@')[0] ?? ''
