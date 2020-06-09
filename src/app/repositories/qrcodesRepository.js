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
          .then(cursor => cursor.toArray(getFirstQrcode));
      })
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
      })
    },

    async updateQrcodeById(qrcodeId, updatedData) {
      return new Promise((resolve, reject) => {
        if (!qrcodeId || !updatedData) {
          reject("invalid parameters");
          return;
        }
        rethinkDb.table('qrcodes')
          .get(qrcodeId)
          .update(updatedData)
          .run(global.connection);
        resolve(updatedData);
      })
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
      })
    }
  }
}

module.exports = QrcodesRepository();