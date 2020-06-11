/* eslint-disable no-return-await */
/* eslint-disable no-use-before-define */
/* eslint-disable no-console */
const azureBlob = require('@azure/storage-blob');

const streamifier = require('streamifier');

const { BlobServiceClient, StorageSharedKeyCredential } = azureBlob;

const ONE_MEGABYTE = 1024 * 1024;
const FOUR_MEGABYTES = 4 * ONE_MEGABYTE;
const MAX_CONCURRENCY = 20;
const ONE_MINUTE = 60 * 1000;
const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountAccessKey = process.env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY;
console.log('[azure-service] iniciando variaveis de ambiente');

async function uploadImage(file, fileName) {
  return await uploadFile(file, fileName, 'images');
}

async function uploadFile(file, fileName, containerName) {
  const sharedKey = new StorageSharedKeyCredential(account, accountAccessKey);
  const azureUrl = `https://${account}.blob.core.windows.net`;
  const blob = new BlobServiceClient(azureUrl, sharedKey);
  const container = blob.getContainerClient(containerName);
  const block = container.getBlockBlobClient(fileName);
  const stream = streamifier.createReadStream(file);
  try {
    await block.uploadStream(stream, FOUR_MEGABYTES, MAX_CONCURRENCY);
    const url = `${azureUrl}/${containerName}/${fileName}`;
    return { url };
  } catch (err) {
    console.log(
      `uploadStream failed, requestId - ${err.details.requestId}, statusCode - ${err.statusCode}, errorCode - ${err.details.errorCode}`,
    );
    return err;
  }
}

module.exports = {
  uploadImage,
};
