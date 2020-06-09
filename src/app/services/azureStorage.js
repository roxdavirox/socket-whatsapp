/* eslint-disable no-return-await */
/* eslint-disable no-use-before-define */
/* eslint-disable no-console */
const azureBlob = require('@azure/storage-blob');

const streamifier = require('streamifier');

const {
  Aborter,
  BlockBlobURL,
  ContainerURL,
  ServiceURL,
  SharedKeyCredential,
  StorageURL,
  uploadStreamToBlockBlob,
} = azureBlob;

const STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const ACCOUNT_ACCESS_KEY = process.env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY;
console.log('[azure-service] iniciando variaveis de ambiente');

const ONE_MEGABYTE = 1024 * 1024;
const FOUR_MEGABYTES = 4 * ONE_MEGABYTE;
const ONE_MINUTE = 60 * 1000;

async function uploadImage(file, fileName) {
  return await uploadFile(file, fileName, 'images');
}

async function uploadFile(file, fileName, containerName) {
  console.log('[azure-service] nome do container:', containerName);
  console.log('[azure-service] autenticando azure credentials');
  const credentials = new SharedKeyCredential(STORAGE_ACCOUNT_NAME, ACCOUNT_ACCESS_KEY);
  console.log('[azure-service] autenticado com sucesso...');
  const pipeline = StorageURL.newPipeline(credentials);
  console.log('[azure-service] criando pipeline do azure blobs');
  const accountUrl = `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`;
  const serviceURL = new ServiceURL(accountUrl, pipeline);
  console.log('[azure-service] iniciando serviços azure blob');
  const aborter = Aborter.timeout(30 * ONE_MINUTE);

  const containerURL = ContainerURL.fromServiceURL(serviceURL, containerName);

  console.log('[azure-service] fileName:', fileName);
  const blockBlobURL = BlockBlobURL.fromContainerURL(containerURL, fileName);

  const stream = streamifier.createReadStream(file);
  console.log('[azure-service] criando stream');
  const uploadOptions = {
    bufferSize: FOUR_MEGABYTES,
    maxBuffers: 5,
  };
  console.log('[azure-service] enviando arquivo');
  const response = await uploadStreamToBlockBlob(
    aborter,
    stream,
    blockBlobURL,
    uploadOptions.bufferSize,
    uploadOptions.maxBuffers,
  );
  console.log('[azure-service] arquivo enviado');
  const { url } = serviceURL;
  const imageUrl = `${url}${containerName}/${fileName}`;
  console.log('[azure-service] url da imagem:', imageUrl);
  return {
    imageUrl,
    ...response,
  };
}

module.exports = {
  uploadImage,
};
