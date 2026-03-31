import { writeFile, mkdir, unlink } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tryCatchAsync } from '@tecnomancy/alchemy'
import type { FileStorage, FileUpload } from '../../domain/ports/file-storage.js'

export const createLocalStorage = (baseDir: string): FileStorage => ({
  upload: (file, path) =>
    tryCatchAsync(async (f: FileUpload, p: string) => {
      const fullPath = join(baseDir, p)
      await mkdir(dirname(fullPath), { recursive: true })
      await writeFile(fullPath, f.buffer)
      return fullPath
    })(file, path),

  getUrl: (path) =>
    tryCatchAsync(async (p: string) => join(baseDir, p))(path),

  remove: (path) =>
    tryCatchAsync(async (p: string) => {
      await unlink(join(baseDir, p))
    })(path),
})
