import { Ok, Err, type Result } from '@tecnomancy/alchemy'

declare const PhoneBrand: unique symbol
export type Phone = string & { readonly [PhoneBrand]: typeof PhoneBrand }

const PHONE_PATTERN = /^\d{10,15}$/

export const parsePhone = (raw: string): Result<Phone, Error> => {
  const digits = raw.replace(/\D/g, '')
  return PHONE_PATTERN.test(digits)
    ? Ok(digits as Phone)
    : Err(new Error(`Invalid phone: ${raw}`))
}

export const phoneToJid = (phone: Phone): string => `${phone}@s.whatsapp.net`
