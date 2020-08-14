/* eslint-disable no-return-assign */
/* eslint-disable no-param-reassign */
/* eslint-disable no-shadow */
const Crypto = require('crypto');
const HKDF = require('futoin-hkdf');
const sharp = require('sharp');
const VideoThumb = require('video-thumb');
const fs = require('fs');
const { v1: uuid } = require('uuid');
/*
    Basic cryptographic utilities to interact with WhatsApp servers
*/
module.exports = {
  // decrypt AES 256 CBC; where the IV is prefixed to the buffer
  aesDecrypt(buffer, key) {
    return this.aesDecryptWithIV(buffer.slice(16, buffer.length), key, buffer.slice(0, 16));
  },
  // decrypt AES 256 CBC
  aesDecryptWithIV(buffer, key, IV) {
    const aes = Crypto.createDecipheriv('aes-256-cbc', key, IV);
    return Buffer.concat([aes.update(buffer), aes.final()]);
  },
  // encrypt AES 256 CBC; where a random IV is prefixed to the buffer
  aesEncrypt(buffer, key) {
    const IV = this.randomBytes(16);
    const aes = Crypto.createCipheriv('aes-256-cbc', key, IV);
    return Buffer.concat([IV, aes.update(buffer), aes.final()]); // prefix IV to the buffer
  },
  // encrypt AES 256 CBC with a given IV
  aesEncrypWithIV(buffer, key, IV) {
    const aes = Crypto.createCipheriv('aes-256-cbc', key, IV);
    return Buffer.concat([aes.update(buffer), aes.final()]); // prefix IV to the buffer
  },
  // sign HMAC using SHA 256
  hmacSign(buffer, key) {
    return Crypto.createHmac('sha256', key).update(buffer).digest();
  },
  sha256(buffer) {
    return Crypto.createHash('sha256').update(buffer).digest();
  },
  // HKDF key expansion
  hkdf(buffer, expandedLength, info) {
    return HKDF(buffer, expandedLength, { salt: Buffer.alloc(32), info, hash: 'SHA-256' });
  },
  // generates all the keys required to encrypt/decrypt & sign a media message
  getMediaKeys(buffer, mediaType) {
    // info to put into the HKDF key expansion
    const appInfo = {
      imageMessage: 'WhatsApp Image Keys',
      videoMessage: 'WhatsApp Video Keys',
      audioMessage: 'WhatsApp Audio Keys',
      documentMessage: 'WhatsApp Document Keys',
      stickerMessage: 'WhatsApp Image Keys',
    };
    // expand using HKDF to 112 bytes, also pass in the relevant app info
    const expandedMediaKey = this.hkdf(buffer, 112, appInfo[mediaType]);
    return {
      iv: expandedMediaKey.slice(0, 16),
      cipherKey: expandedMediaKey.slice(16, 48),
      macKey: expandedMediaKey.slice(48, 80),
    };
  },
  // generates a thumbnail for a given media, if required
  generateThumbnail(buffer, mediaType, info) {
    let promise;
    // don't do anything if the thumbnail is already provided, or is null
    if (info.thumbnail === null || info.thumbnail) {
      if (mediaType === 'audioMessage') {
        promise = Promise.reject(new Error('audio messages cannot have thumbnails'));
      } else {
        promise = Promise.resolve();
      }
    } else if (mediaType === 'imageMessage' || mediaType === 'stickerMessage') {
      promise = sharp(buffer) // generate a 48x48 thumb
        .resize(48, 48)
        .jpeg()
        .toBuffer()
        .then((buffer) => info.thumbnail = buffer.toString('base64'));
    } else if (mediaType === 'videoMessage') {
      const filename = `./${this.randomBytes(5).toString('hex')}.mp4`;
      fs.writeFileSync(filename, buffer);

      promise = new Promise((resolve, reject) => {
        VideoThumb.extract(filename, `${filename}.jpg`, '00:00:00', '48x48', (err) => {
          if (err) {
            console.log(`could not generate video thumb: ${err}`);
            resolve();
          } else {
            const buff = fs.readFileSync(`${filename}.jpg`);
            return sharp(buff)
              .jpeg()
              .toBuffer()
              .then((_buffer) => info.thumbnail = _buffer.toString('base64'))
              .then(() => {
                fs.unlinkSync(filename);
                fs.unlinkSync(`${filename}.jpg`);
                resolve();
              });
          }
        });
      });
    } else {
      promise = Promise.resolve();
    }
    return promise;
  },
  // generate a buffer with random bytes of the specified length
  randomBytes(length) { return Crypto.randomBytes(length); },

  // whatsapp requires a message tag for every message, we just use the timestamp as one
  generateMessageTag() {
    // return new Date().getTime().toString()
    const tag = `${Math.floor(Math.random() * 899999 + 100000)}${Math.floor(Math.random() * 899999 + 100000)}`;
    // console.log('tag gerada:', tag);
    return tag;
  },
  // generate a random 16 byte client ID
  generateClientID() { return this.randomBytes(16).toString('base64'); },
  // generate a random 10 byte ID to attach to a message
  generateMessageID() { return this.randomBytes(10).toString('hex').toUpperCase(); },

  getRandomFileName(extension) {
    const randomFileName = `${uuid()}.${extension}`;
    return randomFileName;
  },
};
