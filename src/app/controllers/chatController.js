const express = require('express');

const router = express.Router();
const multer = require('multer');

const { v1: uuid } = require('uuid');

const MAX_FILE_SIZE = 1024 * 10;
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });
const azure = require('../services/azureStorage');
const ContactsRepository = require('../repositories/contactsRepository');
const MessagesRepository = require('../repositories/messagesRepository');
const ChatsRepository = require('../repositories/chatsRepository');

const extensionType = {
  'image/jpeg': 'jpg',
};

module.exports = ({ app, sharedSessions }) => {
  const uploadImage = async (req, res) => {
    const {
      contactId, ownerId, userId,
    } = req.body;
    const { file } = req;
    const sessionExists = sharedSessions.sessionExists(ownerId);
    if (!sessionExists) {
      return res.status(400).send({ error: 'session not exists' });
    }
    const session = sharedSessions.getSession(ownerId);
    try {
      const contact = await ContactsRepository.getContactById(contactId);
      const fileExtension = extensionType[file.mimetype];
      const fileName = `${uuid()}.${fileExtension}`;
      const { buffer } = file;
      const url = await azure.uploadImage(buffer, fileName);
      const messageSent = await session.sendMediaMessage(contact.jid, buffer, 'imageMessage');
      const chat = await ChatsRepository.getChatByContactId(contact.id);
      const time = new Date();
      const messageToStore = {
        ownerId,
        userId,
        contactId,
        chatId: chat.id,
        time,
        ...messageSent,
        message: {
          imageMessage: {
            ...messageSent.message.imageMessage,
            fileUrl: url,
            caption: '',
          },
        },
      };

      ChatsRepository.updateByContactId(contactId, { lastMessageTime: time });
      MessagesRepository.addNewMessageFromClient(messageToStore);
      console.log('[chat-controller] message image send', messageToStore);
      return res.status(200).send({ url });
    } catch (e) {
      return res
        .status(400)
        .send({ error: `${e}` });
    }
  };

  router.post('/image', upload.single('image'), uploadImage);

  return app.use('/chat', router);
};
