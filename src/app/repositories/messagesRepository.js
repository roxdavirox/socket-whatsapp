// docs: https://rethinkdb.com/docs/permissions-and-accounts/
const rethinkDb = require('rethinkdb');
const ContactsRepository = require('./contactsRepository');
const ChatsRepository = require('./chatsRepository');

function MessagesRepository() {
  return {
    async waitForMessage(userId, cb) {
      const sendEachMessage = (cursor) => {
        cursor.each((error, msg) => {
          const newValue = msg.new_val;
          cb(newValue);
        });
      };

      return rethinkDb
        .table('messages')
        .filter(
          rethinkDb
            .row('userId')
            .eq(userId),
        )
        .changes()
        .run(global.connection)
        .then(sendEachMessage);
    },

    async getMessagesByContactId(contactId) {
      return new Promise((resolve, reject) => {
        rethinkDb
          .table('messages')
          .filter({ contactId })
          .orderBy(rethinkDb.desc('createdAt'))
          .slice(0, 15)
          .run(global.connection)
          .then((cursor) => cursor.toArray((error, messages) => {
            if (error) {
              reject(new Error('Error when get contact messages: ', error));
              return;
            }
            resolve(messages);
          }))
          .catch(reject);
      });
    },

    async getMessagesBetween(contactId, start = 0, end = 15) {
      return new Promise((resolve, reject) => {
        rethinkDb
          .table('messages')
          .filter({ contactId })
          .orderBy(rethinkDb.desc('createdAt'))
          .slice(start, end)
          .run(global.connection)
          .then((cursor) => cursor.toArray((error, messages) => {
            if (error) {
              reject(new Error('Error when get contact messages: ', error));
              return;
            }
            resolve(messages);
          }))
          .catch(reject);
      });
    },

    async getMessagesCountByContactId(contactId) {
      return new Promise((resolve, reject) => {
        const length = rethinkDb
          .table('messages')
          .filter({ contactId })
          .count()
          .run(global.connection);
        if (!length) {
          reject(new Error('length error'));
        }
        resolve(length);
      });
    },

    async addNewMessageFromWhatsApp(remoteJid, ownerId, message) {
      return new Promise(async (resolve, reject) => {
        const contact = await ContactsRepository.getContact(remoteJid, ownerId);
        if (!contact) reject('Contact not found');

        const chat = await ChatsRepository.getChatByContactId(contact.id);
        if (!chat) reject('Chat not found');

        const msg = {
          ownerId: contact.ownerId,
          contactId: contact.id,
          userId: contact.userId,
          chatId: chat.id,
          createdAt: rethinkDb.now(),
          ...message,
        };

        rethinkDb.table('messages')
          .insert(msg)
          .run(global.connection);

        resolve(msg);
      });
    },

    async addNewMessageFromClient(message) {
      return new Promise((resolve, reject) => {
        if (!message) reject(new Error('no message provided'));
        const newMessage = {
          createdAt: rethinkDb.now(),
          ...message,
        };
        rethinkDb.table('messages')
          .insert(newMessage)
          .run(global.connection);
        resolve(message);
      });
    },
  };
}

module.exports = MessagesRepository();
