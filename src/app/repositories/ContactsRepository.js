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
    },

    async getContactByRemoteJid(remoteIjd) {
      return new Promise((resolve, reject) => {
        const handleResolveContact = (error, contact) => {
          if (error) reject(error);
          resolve(contact);
        };

        const getFirstContact = cursor => cursor.next(handleResolveContact);
        
        rethinkDb.table('contacts')
          .filter({ jid: remoteIjd })
          .run(global.connection)
          .then(getFirstContact);
      })
    },
  }
}

module.exports = ContactsRepository();
