const rethinkDb = require('rethinkdb');

function ChatsRepository() {
  return {
    getChatsByUserId(userId, connection) {
      return new Promise((resolve, reject) => {
        rethinkDb.table('chats')
          .filter({ userId })
          .run(connection)
          .then(cursor => {
            cursor.toArray((err, chats) => {
              if(err) reject(err);
              resolve(chats);
            });
          });
      });
    },

    getChatByUserId(userId, connection){
      return new Promise((resolve, reject) => {
        rethinkDb.table('chats')
          .filter({ userId })
          .run(connection)
          .then(cursor => {
            cursor.toArray((err, chats) => {
              if(err) reject(err);
              const [chat] = chats;
              if(!chat) reject('chat não encontrado');
              resolve(chat);
            });
          });
      });
    }
  }
}

module.exports = new ChatsRepository();
