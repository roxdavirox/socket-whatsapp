const rethinkDb = require('rethinkdb');

function ContactsRepository() {
  return {
    getContactsByUserId(userId, connection) {
      return new Promise((resolve, reject) => {
        rethinkDb.table('contacts')
          .filter({ userId })
          .run(connection).then(cursor => {
            cursor.toArray((err, contacts) => {
              if(err) {
                reject(err);
                return;
              }
              resolve(contacts);
            });
        });
      })
    }
  }
}

module.exports = new ContactsRepository();
