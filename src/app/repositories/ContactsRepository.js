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
      });
    },

    async getContactByRemoteJid(remoteIjd) {
      return new Promise((resolve, reject) => {
        const getFirst = (error, contacts) => {
          if (error) {
            console.log('contact repo error: ', error);
            reject(error);
            return false;
          }
          const [contact] = contacts;
          if (!contact) {
            console.log('contact undefined');
            return false;
          }
          resolve(contact);
        };

        rethinkDb.table('contacts')
          .filter({ jid: remoteIjd })
          .run(global.connection)
          .then(cursor => cursor.toArray(getFirst));
      });
    },

    async addContacts(contacts) {
      return new Promise((resolve, reject) => {
        if (!contacts) {
          reject("contacts is undefined");
          return;
        }

        rethinkDb
          .table('contacts')
          .insert(contacts)
          .run(global.connection);
        
        resolve(contacts);
      });
    },

    async addContact(contact = {}) {
      if (!contact) {
        reject("contact is undefined");
        return;
      }

      const result = rethinkDb
        .table('contacts')
        .insert(contact)
        .run(global.connection);
      resolve(result);
    },

    async contactExistsByJid(contactJid) {
      if (!contactJid) {
        reject("jid not found");
        return;
      }

      const remoteJid = contactJid.includes('@s.whatsapp.net') 
        ? contactJid 
        : `${contactJid}@s.whatsapp.net`;

      const contact = await this.getContactByRemoteJid(remoteJid);
      if (!contact) {
        return false;
      }

      return contact.jid === remoteJid;
    }
  }
}

module.exports = ContactsRepository();
