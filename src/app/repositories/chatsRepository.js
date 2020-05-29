const rethinkDb = require('rethinkdb');

function ChatsRepository() {
  return {
    getChatsByUserId(userId) {
      return new Promise((resolve, reject) => {
        rethinkDb.table('chats')
          .filter({ userId })
          .run(global.connection)
          .then(cursor => {
            cursor.toArray((err, chats) => {
              if(err) reject(err);
              resolve(chats);
            });
          });
      });
    },

    getChatByUserId(userId) {
      return new Promise((resolve, reject) => {
        rethinkDb.table('chats')
          .filter({ userId })
          .run(global.connection)
          .then(cursor => {
            cursor.toArray((err, chats) => {
              if(err) reject(err);
              const [chat] = chats;
              if(!chat) reject('chat não encontrado');
              resolve(chat);
            });
          });
      });
    },

    async getChatByContactId(contactId) {
      return new Promise((resolve, reject) => {
        rethinkDb
          .table('chats')
          .filter({ contactId })
          .run(global.connection)
          .then(cursor => {
            cursor.toArray((err, chats) => {
              if(err) reject(err);
              const [chat] = chats;
              if(!chat) reject('chat não encontrado');
              resolve(chat);
            });
          });
      });
    },

    async addChat(chat = {}) {
      return new Promise((resolve, reject) => {
        if (!chat) {
          reject("chat is undefined");
          return;
        }
  
        rethinkDb
          .table('chats')
          .insert(chat)
          .run(global.connection)
          .then(res => {
            if (res.inserted > 0) {
              const { generated_keys } = res;
              const [chatId] = generated_keys;
              resolve(chatId);
              return;
            }
            reject("chat not inserted");
          });
      })
    },

    async updateByContactId(contactId, userId) {
      return new Promise((resolve, reject) => {
        if (!contactId || !userId) {
          console.log('data undefined');
          reject('data undefined');
          return;
        }

        rethinkDb
          .table('chats')
          .filter({ contactId })
          .update({ userId })
          .run(global.connection)
          .then(() => resolve(true));
        
      });
    }

  }
}

module.exports = ChatsRepository();