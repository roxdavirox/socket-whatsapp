import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob'
import { tryCatchAsync } from '@tecnomancy/alchemy'
import type { FileStorage, FileUpload } from '../../domain/ports/file-storage.js'

type AzureConfig = {
  readonly accountName: string
  readonly accountKey: string
  readonly containerName: string
}

export const createAzureStorage = (config: AzureConfig): FileStorage => {
  const credential = new StorageSharedKeyCredential(config.accountName, config.accountKey)
  const blobService = new BlobServiceClient(
    `https://${config.accountName}.blob.core.windows.net`,
    credential,
  )
  const container = blobService.getContainerClient(config.containerName)

  return {
    upload: (file, path) =>
      tryCatchAsync(async (f: FileUpload, p: string) => {
        const blob = container.getBlockBlobClient(p)
        await blob.uploadData(f.buffer, {
          blobHTTPHeaders: { blobContentType: f.mimetype },
        })
        return blob.url
      })(file, path),

    getUrl: (path) =>
      tryCatchAsync(async (p: string) => {
        const blob = container.getBlockBlobClient(p)
        return blob.url
      })(path),

    remove: (path) =>
      tryCatchAsync(async (p: string) => {
        const blob = container.getBlockBlobClient(p)
        await blob.delete()
      })(path),
  }
}
