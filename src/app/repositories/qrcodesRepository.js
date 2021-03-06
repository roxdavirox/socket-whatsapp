// docs: https://rethinkdb.com/docs/permissions-and-accounts/
const rethinkDb = require('rethinkdb');

function QrcodesRepository() {
  return {
    async getAuthQrcodeInfoByOwnerId(ownerId) {
      return new Promise((resolve, reject) => {
        const getFirstQrcode = (error, qrcodes) => {
          if (error) resolve(error);
          const [qrcode] = qrcodes;
          if (!qrcode) resolve(false);
          resolve(qrcode);
        };

        rethinkDb
          .table('qrcodes')
          .filter({ ownerId })
          .run(global.connection)
          .then((cursor) => cursor.toArray(getFirstQrcode));
      });
    },

    async removeByOwnerId(ownerId) {
      return new Promise((resolve, reject) => {
        rethinkDb
          .table('qrcodes')
          .filter({ ownerId })
          .delete()
          .run(global.connection)
          .then(resolve)
          .catch(reject);
      });
    },

    async disconnectByOwnerId(ownerId) {
      return new Promise((resolve, reject) => {
        rethinkDb
          .table('qrcodes')
          .filter({ ownerId })
          .update({ isConnected: false })
          .run(global.connection)
          .then(resolve)
          .catch(reject);
      });
    },

    async updateAuthInfo(authInfo, ownerId) {
      return new Promise((resolve, reject) => {
        rethinkDb
          .table('qrcodes')
          .filter({ ownerId })
          .update({ isConnected: true, authInfo })
          .run(global.connection)
          .then(resolve)
          .catch(reject);
      });
    },

    async qrcodeExists(ownerId) {
      if (!ownerId) {
        return false;
      }

      const qrcode = await this.getAuthQrcodeInfoByOwnerId(ownerId);
      if (!qrcode) return false;

      return qrcode.ownerId === ownerId;
    },

    async updateQrcodeById(qrcodeId, updatedData) {
      return new Promise((resolve, reject) => {
        if (!qrcodeId || !updatedData) {
          reject(new Error('invalid parameters'));
          return;
        }
        rethinkDb.table('qrcodes')
          .get(qrcodeId)
          .update(updatedData)
          .run(global.connection);
        resolve(updatedData);
      });
    },

    async getQrcodeStatusByOwnerId(ownerId) {
      const qrcode = await this.getAuthQrcodeInfoByOwnerId(ownerId);
      if (!qrcode) return false;
      return qrcode.isConnected;
    },

    async storeQrcodeAuthInfo(authInfo, ownerId) {
      return new Promise(async (resolve, reject) => {
        const qrcode = await this.getAuthQrcodeInfoByOwnerId(ownerId);

        if (!qrcode) {
          const newQrcode = { authInfo, isConnected: true, ownerId };
          rethinkDb.table('qrcodes')
            .insert(newQrcode)
            .run(global.connection);
          resolve(newQrcode);
          return;
        }

        await this.updateQrcodeById(qrcode.id, { authInfo });
        resolve(qrcode);
      });
    },

    async getAllConnectedQrcodes() {
      return new Promise((resolve, reject) => {
        rethinkDb.table('qrcodes')
          .filter({ isConnected: true })
          .run(global.connection)
          .then((cursor) => {
            cursor.toArray((err, qrcodes) => {
              if (err) reject(err);
              resolve(qrcodes);
            });
          })
          .catch(reject);
      });
    },
  };
}

module.exports = QrcodesRepository();
