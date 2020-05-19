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
      })
    }
  }
}

module.exports = ChatsRepository();
