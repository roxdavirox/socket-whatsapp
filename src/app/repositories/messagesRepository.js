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
        .filter({ userId })
        .changes()
        .run(global.connection)
        .then(sendEachMessage);
    },

    async getMessagesByContactId(contactId) {
      return new Promise((resolve, reject) => {
        rethinkDb
          .table('messages')
          .filter({ contactId })
          .orderBy('time')
          .run(global.connection)
          .then((cursor) => cursor.toArray((error, messages) => {
            if (error) {
              reject('Error when get contact messages: ', error);
              return;
            }
            resolve(messages);
          }))
          .catch(reject);
      });
    },

    async addNewMessageFromWhatsApp(remoteJid, contactId, message) {
      return new Promise(async (resolve, reject) => {
        const contact = await ContactsRepository.getContact(remoteJid, contactId);
        if (!contact) reject('Contact not found');

        const chat = await ChatsRepository.getChatByContactId(contact.id);
        if (!chat) reject('Chat not found');

        const msg = {
          ownerId: contact.ownerId,
          contactId: contact.id,
          userId: contact.userId,
          chatId: chat.id,
          time: new Date(),
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
        if (!message) reject('no message provided');
        rethinkDb.table('messages')
          .insert(message)
          .run(global.connection);
        resolve(message);
      });
    },
  };
}

module.exports = MessagesRepository();
