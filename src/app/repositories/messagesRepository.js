// docs: https://rethinkdb.com/docs/permissions-and-accounts/
const rethinkDb = require('rethinkdb');
const ContactsRepository = require('./contactsRepository');
const ChatsRepository = require('./chatsRepository');

function MessagesRepository() {
  return {
    async waitForMessage(userId, cb) {
      const sendEachMessage = cursor => {
        cursor.each((error, msg) => {
          const newValue = msg.new_val;
          cb(newValue);
        });
      }

      return rethinkDb
        .table('messages')
        .filter({ userId })
        .changes()
        .run(global.connection)
        .then(sendEachMessage);
    },

    async addNewMessageFromWhatsApp(remoteJid, message) {
      return new Promise(async (resolve, reject) => {
        const contact = await ContactsRepository.getContactByRemoteJid(remoteJid);
        if (!contact) reject("Contact not found");

        const chat = await ChatsRepository.getChatByContactId(contact.id);
        if (!chat) reject("Chat not found");;
        
        const msg = {
          ownerId: contact.ownerId,
          contactId: contact.id,
          userId: contact.userId,
          chatId: chat.id,
          time: new Date(),
          ...message
        };

        rethinkDb.table('messages')
          .insert(msg)
          .run(global.connection);

        resolve(msg);
      });
    },

    async addNewMessageFromClient(message) {
      return new Promise((resolve, reject) => {
        if (!message) reject("no message provided");
        rethinkDb.table('messages')
          .insert(message)
          .run(global.connection);
        resolve(message);
      })
    }
  }
}

module.exports = MessagesRepository();