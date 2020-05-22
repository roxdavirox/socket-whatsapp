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
            resolve(false);
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
      return new Promise((resolve, reject) => {
        if (!contact) {
          reject("contact is undefined");
          return;
        }
  
        rethinkDb
          .table('contacts')
          .insert(contact)
          .run(global.connection)
          .then(res => {
            if (res.inserted > 0) {
              const { generated_keys } = res;
              const [contactId] = generated_keys;
              resolve(contactId);
              return;
            }
            reject("Contact not inserted");
          });
      })
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
