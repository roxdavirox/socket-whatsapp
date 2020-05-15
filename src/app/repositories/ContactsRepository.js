const rethinkDb = require('rethinkdb');

function ContactsRepository({ connection }) {
  return {
    getContactsByUserId(userId) {
      return new Promise((resolve, reject) => {
        rethinkDb.table('contacts')
          .filter({ userId })
          .run(connection)
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

module.exports = deps => ContactsRepository(deps);
