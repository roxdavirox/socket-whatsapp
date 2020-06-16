const rethinkDb = require('rethinkdb');

function ContactsRepository() {
  return {
    getContactsByUserId(userId) {
      return new Promise((resolve, reject) => {
        rethinkDb.table('contacts')
          .filter({ userId })
          .run(global.connection)
          .then((cursor) => {
            cursor.toArray((err, contacts) => {
              if (err) reject(err);
              resolve(contacts);
            });
          });
      });
    },

    async getContactById(contactId) {
      return new Promise((resolve, reject) => {
        if (!contactId) {
          console.log('undefined contactId');
          reject(false);
        }

        rethinkDb.table('contacts')
          .get(contactId)
          .run(global.connection)
          .then((contact) => {
            resolve(contact);
          });
      });
    },

    async getContactBy(remoteIjd, ownerId) {
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
          .filter({ jid: remoteIjd, ownerId })
          .run(global.connection)
          .then((cursor) => cursor.toArray(getFirst));
      });
    },

    async addContacts(contacts) {
      return new Promise((resolve, reject) => {
        if (!contacts) {
          reject('contacts is undefined');
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
          reject('contact is undefined');
          return;
        }

        rethinkDb
          .table('contacts')
          .insert(contact)
          .run(global.connection)
          .then((res) => {
            if (res.inserted > 0) {
              const { generated_keys } = res;
              const [contactId] = generated_keys;
              resolve(contactId);
              return;
            }
            reject('Contact not inserted');
          });
      });
    },

    async contactExists(contactJid, ownerId) {
      if (!contactJid) {
        return false;
      }

      const remoteJid = contactJid.includes('@s.whatsapp.net')
        ? contactJid
        : `${contactJid}@s.whatsapp.net`;

      const contact = await this.getContactByRemoteJid(remoteJid, ownerId);
      if (!contact) return false;

      return contact.jid === remoteJid;
    },

    async updateByContactId(contactId, newData) {
      return new Promise((resolve, reject) => {
        if (!newData) {
          console.log('data undefined');
          reject('data undefined');
          return;
        }

        rethinkDb
          .table('contacts')
          .get(contactId)
          .update(newData)
          .run(global.connection)
          .then(() => resolve(true));
      });
    },

    async updateName(contactId, name) {
      return new Promise((resolve, reject) => {
        if (!contactId || !name) {
          console.log('data undefined');
          reject('data undefined');
          return;
        }

        rethinkDb
          .table('contacts')
          .get(contactId)
          .update({ name, short: name, notify: name })
          .run(global.connection)
          .then(() => resolve(true));
      });
    },
  };
}

module.exports = ContactsRepository();
