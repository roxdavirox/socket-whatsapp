const rethinkDb = require('rethinkdb');

function ContactsRepository() {
  return {
    getContactsByUserId(userId) {
      return new Promise((resolve, reject) => {
        rethinkDb.table('contacts')
          .filter({ userId })
          .run(global.connection)
          .then(cursor => {
            cursor.toArray((err, contacts) => {
              if(err) reject(err);
              resolve(contacts);
            });
        });
      })
    }
  }
}

module.exports = ContactsRepository();
