import type { Result } from '@tecnomancy/alchemy'

export type FileUpload = {
  readonly buffer: Buffer
  readonly filename: string
  readonly mimetype: string
}

export type FileStorage = {
  readonly upload: (file: FileUpload, path: string) => Promise<Result<string, Error>>
  readonly getUrl: (path: string) => Promise<Result<string, Error>>
  readonly remove: (path: string) => Promise<Result<void, Error>>
}
