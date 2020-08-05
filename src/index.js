/* eslint-disable consistent-return */
/* eslint-disable no-console */
/* eslint-disable no-prototype-builtins */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));

const server = require('http').Server(app);
const io = require('socket.io')(server);

const dotenv = require('dotenv');

dotenv.config();

const jwtAuth = require('socketio-jwt-auth');
const config = require('./config.json');
const WhatsAppWeb = require('./app/core/lib/WhatsAppWeb');
const SharedSession = require('./app/session/SharedSession');
const ContactsRepository = require('./app/repositories/contactsRepository');
const ChatsRepository = require('./app/repositories/chatsRepository');
const MessagesRepository = require('./app/repositories/messagesRepository');
const QrcodeRepository = require('./app/repositories/qrcodesRepository');
const UsersRepository = require('./app/repositories/usersRepository');

global.connection = null;
const dbContext = require('./app/data');

const sharedSessions = new SharedSession();

function connectAllQrcodes() {
  QrcodeRepository.getAllConnectedQrcodes()
    .then((qrcodes) => {
      qrcodes.forEach((qrcode) => {
        console.log('[qrcode] connecting: ', qrcode.ownerId);
        const whatsAppWeb = sharedSessions
          .createSession(new WhatsAppWeb(), qrcode.ownerId);
        const { authInfo } = qrcode;
        whatsAppWeb.login(authInfo);

        whatsAppWeb.handlers.onConnected = () => {
        };

        whatsAppWeb.handlers.onReceiveUserPhone = async (wid) => {
          const pictureResponse = await whatsAppWeb.getProfilePicture(wid);
          if (pictureResponse.status) return;
          await UsersRepository.updateUsersByOwnerId(qrcode.ownerId, { eurl: pictureResponse.eurl });
        };

        whatsAppWeb.onNewMessage = async (message) => {
          if (message.key.fromMe || !message.key) return;
          const isGroup = message.key.remoteJid.includes('-');
          const isStatus = message.key.remoteJid.includes('status');
          // eslint-disable-next-line no-prototype-builtins
          if (message.key.remoteJid && (isStatus || isGroup)) return;
          if (!message.message) return;
          // verificar como exibir um sticker
          const isImage = message.message.hasOwnProperty('imageMessage');
          if (isImage) {
            console.log('[qrcode-socket] Imagem recebida');
            await whatsAppWeb.decodeMediaMessage(message.message);
          }
          const isAudio = message.message.hasOwnProperty('audioMessage');
          if (isAudio) {
            console.log('[qrcode-socket] audio recebido');
            await whatsAppWeb.decodeMediaMessage(message.message);
          }
          const isDocument = message.message.hasOwnProperty('documentMessage');
          if (isDocument) {
            console.log('[qrcode-socket] documento recebido');
            await whatsAppWeb.decodeMediaMessage(message.message);
          }
          console.log('nova mensagem do whatsapp:', message);
          const time = new Date();

          const { remoteJid } = message.key;
          const contactExists = await ContactsRepository.contactExists(remoteJid, qrcode.ownerId);

          if (!contactExists) {
            const phone = remoteJid.split('@')[0];
            const contact = {
              jid: remoteJid,
              ownerId: qrcode.ownerId,
              userId: qrcode.ownerId,
              phone,
              name: phone,
              short: phone,
              active: true,
            };
            const contactId = await ContactsRepository.addContact(contact);

            // eslint-disable-next-line no-unused-vars
            await ChatsRepository.addChat({
              userId: qrcode.ownerId,
              ownerId: qrcode.ownerId,
              contactId,
            });
          }
          const contact = await ContactsRepository.getContact(remoteJid, qrcode.ownerId);
          if (!contact) return;
          await ContactsRepository.updateByContactId(contact.id, { active: true });
          ChatsRepository.updateLastTimeAndMessage(
            contact.id,
            message.message.conversation || 'Nova mensagem',
          );
          MessagesRepository.addNewMessageFromWhatsApp(remoteJid, contact.ownerId, {
            ...message, time,
          });
        };

        whatsAppWeb.handlers.onGenerateQrcode = (qr) => {
        };

        whatsAppWeb.handlers.onError = (err) => {
          console.error('[whatsapp] error: ', err);
          const currentSession = sharedSessions.getSession(qrcode.ownerId);
          currentSession.close();
          QrcodeRepository.disconnectByOwnerId(qrcode.ownerId);
          sharedSessions.removeSession(qrcode.ownerId);
        };

        whatsAppWeb.handlers.onDisconnect = async () => {
          console.log('[qrcode-socket] whatsapp disconnected');
          QrcodeRepository.disconnectByOwnerId(qrcode.ownerId);
          sharedSessions.removeSession(qrcode.ownerId);
        };
      });
    });
}

dbContext.then((conn) => {
  global.connection = conn;
  console.log('[rethinkDb] - connected');
  connectAllQrcodes();
});

// inject deps
require('./app/controllers')({
  app,
  connection: global.connection,
  sharedSessions,
});

io.use(jwtAuth.authenticate({
  secret: config.jwt.secret, // required, used to verify the token's signature
  algorithm: 'HS256', // optional, default to be HS256
}, (payload, done) => {
  // done is a callback, you can use it as follows
  console.log('[auth-socket] checking token...');
  const { user } = payload;
  if (!user) {
    console.log('[qrcode-socket] user not found at token');
    return done(null, false, '[qrcode-socket] user not found at token');
  }
  return done(null, user);
}));

// TODO: separar os tipos de conexões
const qrcodeSocket = io.of('qrcode');
const chatSocket = io.of('chat');

qrcodeSocket.on('connection', async (qrcodeClient) => {
  const { user } = qrcodeClient.request;
  if (!user) {
    console.log('[qrcode-socket] user not provided');
    return;
  }

  if (user.role !== 'ADMIN') {
    console.log('[qrcode-socket] user is not ADM role');
    return;
  }

  const sessionExists = sharedSessions.sessionExists(user.id);
  const qrcodeConnected = await QrcodeRepository.getQrcodeStatusByOwnerId(user.id);

  if (sessionExists) {
    console.log('[qrcode-socket] session already exists');
    qrcodeClient.emit('qrcodeStatusConnection', qrcodeConnected);
    if (qrcodeConnected) {
      qrcodeClient.disconnect();
      return;
    }

    const whatsAppweb = sharedSessions.getSession(user.id);
    whatsAppweb.close();
    sharedSessions.removeSession(user.id);
  }

  const whatsAppWeb = sharedSessions.createSession(new WhatsAppWeb(), user.id);

  console.log('[qrcode-socket] new connection');

  QrcodeRepository
    .getAuthQrcodeInfoByOwnerId(user.id)
    .then((qrcode) => {
      if (!qrcode || !qrcode.isConnected) {
        whatsAppWeb.connect(); // start a new session, with QR code scanning and what not
        console.log('[qrcode-socket] ready to scan QRCODE', qrcode);
        return qrcode;
      }
      const { authInfo } = qrcode;
      whatsAppWeb.login(authInfo);
      console.log('[qrcode-socket] qrcode connected successfuly');
      setTimeout(() => qrcodeClient.emit('qrcodeStatusConnection', true), 2000);

      return qrcode;
    })
    .catch(console.error);

  whatsAppWeb.handlers.onConnected = async () => {
    // get all the auth info we need to restore this session
    const authInfo = whatsAppWeb.base64EncodedAuthInfo();
    const qrcodeExists = await QrcodeRepository.qrcodeExists(user.id);

    const isFirstQrcodeConnection = !qrcodeConnected && !qrcodeExists;
    if (isFirstQrcodeConnection) {
      console.log('[qrcode-socket] storing first qrcode auth info connection');
      await QrcodeRepository.storeQrcodeAuthInfo(authInfo, user.id);
      console.log('[qrcode-socket] qrcode auth info stored successfully');
    } else {
      console.log('[qrcode-socket] updating qrcode auth info connection');
      await QrcodeRepository.updateAuthInfo(authInfo, user.id);
      console.log('[qrcode-socket] qrcode auth info updated successfully');
    }

    console.log('[qrcode-socket] whatsapp onConnected event');
    qrcodeSocket.emit('qrcodeStatusConnection', true);
  };

  whatsAppWeb.handlers.onReceiveUserPhone = async (wid) => {
    const pictureResponse = await whatsAppWeb.getProfilePicture(wid);
    if (pictureResponse.status) return;
    await UsersRepository.updateUsersByOwnerId(user.ownerId, { eurl: pictureResponse.eurl });
  };

  whatsAppWeb.onNewMessage = async (message) => {
    if (message.key.fromMe || !message.key) return;
    const isGroup = message.key.remoteJid.includes('-');
    const isStatus = message.key.remoteJid.includes('status');
    // eslint-disable-next-line no-prototype-builtins
    if (message.key.remoteJid && (isStatus || isGroup)) return;
    if (!message.message) return;

    const isImage = message.message.hasOwnProperty('imageMessage');
    const isAudio = message.message.hasOwnProperty('audioMessage');
    const isDocument = message.message.hasOwnProperty('documentMessage');

    if (isImage || isAudio || isDocument) {
      console.log('[qrcode-socket] arquivo recebido');
      await whatsAppWeb.decodeMediaMessage(message.message);
    }

    console.log('nova mensagem do whatsapp:', message);
    const time = new Date();

    const { remoteJid } = message.key;
    const contactExists = await ContactsRepository.contactExists(remoteJid, user.ownerId);

    if (!contactExists) {
      const phone = remoteJid.split('@')[0];
      const contact = {
        jid: remoteJid,
        ownerId: user.id,
        userId: user.id,
        phone,
        name: phone,
        short: phone,
        active: true,
      };
      const contactId = await ContactsRepository.addContact(contact);

      // eslint-disable-next-line no-unused-vars
      await ChatsRepository.addChat({
        userId: user.id,
        ownerId: user.id,
        contactId,
      });
    }
    const contact = await ContactsRepository.getContact(remoteJid, user.ownerId);
    if (!contact) return;
    await ContactsRepository.updateByContactId(contact.id, { active: true });
    ChatsRepository.updateLastTimeAndMessage(
      contact.id,
      message.message.conversation || 'Nova mensagem',
    );
    MessagesRepository.addNewMessageFromWhatsApp(remoteJid, contact.ownerId, {
      ...message, time,
    });
  };

  whatsAppWeb.handlers.onGenerateQrcode = (qr) => {
    qrcodeClient.emit('qrcode', qr);
  };

  whatsAppWeb.handlers.onError = (err) => {
    console.error('[whatsapp] error: ', err);
    qrcodeSocket.emit('qrcodeStatusConnection', false);
    const currentSession = sharedSessions.getSession(user.id);
    currentSession.close();
    sharedSessions.removeSession(user.id);
    QrcodeRepository.disconnectByOwnerId(user.id);
    qrcodeClient.disconnect();
  };

  whatsAppWeb.handlers.onDisconnect = async () => {
    console.log('[qrcode-socket] whatsapp disconnected');
    qrcodeSocket.emit('qrcodeStatusConnection', false);
    // QrcodeRepository.removeByOwnerId(user.id);
    // whatsAppWeb.close();
    sharedSessions.removeSession(user.id);
    QrcodeRepository.disconnectByOwnerId(user.id);
    qrcodeClient.disconnect();
  };
});

chatSocket.on('connection', (chatClient) => {
  console.log('[chat-socket] novo chat conectado');
  const { user } = chatClient.request;

  if (!user) {
    console.log('[chat-socket] no user provided');
    chatClient.disconnect();
    return;
  }

  const ownerId = user.role === 'ADMIN'
    ? user.id
    : user.ownerId;

  const hasActiveOwnerSession = sharedSessions.sessionExists(ownerId);
  if (!hasActiveOwnerSession) {
    console.log('[chat-socket] no active owner session');
    // TODO: enviar para o client que o qrcode está desconectado no ADMIN
    return;
  }

  const qrcodeIsConnected = QrcodeRepository.getQrcodeStatusByOwnerId(user.ownerId);

  if (!qrcodeIsConnected) {
    console.log('[chat-socket] qrcode not found');
    return;
  }

  chatClient.join(user.id);
  chatClient.on('disconnect', () => {
    console.log('[socket-chat] client disconnect...', chatClient.id);
    chatClient.disconnect();
  });

  chatClient.on('error', (err) => {
    console.log('[chat-socket] received error from client:', chatClient.id);
    console.log(err);
  });

  const { getContactsByUserId, getContactsByOwnerId } = ContactsRepository;
  const getContacts = user.role === 'ADMIN'
    ? getContactsByOwnerId
    : getContactsByUserId;

  const { getChatsByUserId, getChatsByOwnerId } = ChatsRepository;
  const getChats = user.role === 'ADMIN'
    ? getChatsByOwnerId
    : getChatsByUserId;

  getContacts(user.id)
    .then(async (contacts) => {
      const whatsAppWeb = sharedSessions.getSession(ownerId);
      const mappedContacts = contacts.map(async (contact) => {
        if (!contact) return;
        const [jid] = contact.jid.split('@');
        const formatedJid = `${jid}@c.us`;
        const response = await whatsAppWeb.getProfilePicture(formatedJid);
        if (!response.eurl) return contact;
        // eslint-disable-next-line consistent-return
        return { ...contact, eurl: response.eurl };
      });
      const contactsWithPicture = await Promise.all(mappedContacts);
      chatClient.emit('contacts', contactsWithPicture);
      getChats(user.id).then((chats) => {
        chatClient.emit('chats', chats);
      });
    });

  UsersRepository.getUsersByOwnerId(ownerId)
    .then((users) => {
      // console.log('[chat-socket] users to transfer', users);
      chatClient.emit('transferUsers', users);
    });

  chatClient.on('message', (message) => {
    // envia mensagem do front para o whatsapp
    const whatsAppWeb = sharedSessions.getSession(ownerId);
    // eslint-disable-next-line no-undef
    if (!whatsAppWeb || !whatsAppWeb.conn) {
      console.log('[chat-socket] não há conexão com o whatsapp web');
      QrcodeRepository.removeByOwnerId(user.id);
      // whatsAppWeb.close();
      sharedSessions.removeSession(user.id);
      console.log('[chat-socket] desconectado e sessão removida!');
      chatClient.disconnect();
      return;
    }
    console.log('[chat-socket] new message', message);
    const {
      text, jid, contactId, chatId,
    } = message;

    const messageSent = whatsAppWeb.sendTextMessage(jid, text);
    const messageToStore = {
      ownerId,
      userId: user.id,
      contactId,
      chatId,
      ...messageSent,
    };
    ChatsRepository.updateLastTimeAndMessage(
      contactId,
      messageToStore.message.conversation || 'Nova mensagem',
    );
    MessagesRepository.addNewMessageFromClient(messageToStore);
    ContactsRepository.updateByContactId(contactId, { active: true });
    console.log('[chat-socket] mensagem enviada');
  });

  chatClient.on('saveContact', async (data) => {
    if (!data.contactId || !data.name) {
      console.log('[chat-socket] save contact error');
      return;
    }

    const { contactId, name } = data;
    await ContactsRepository.updateName(contactId, name);
  });

  chatClient.on('transfer', async (data) => {
    if (!data.userId || !data.contactId) {
      console.log('[chat-socket] transfer error');
      return;
    }

    const { contactId, userId } = data;

    await ContactsRepository.updateByContactId(contactId, { userId });

    await ChatsRepository.updateByContactId(contactId, { userId });
    await ChatsRepository.updateLastMessageByContactId(contactId);
    const chat = await ChatsRepository.getChatByContactId(contactId);
    const contactToTransfer = await ContactsRepository.getContactById(contactId);
    chatClient.to(userId).emit('transferContact', { contact: contactToTransfer, chat });
  });

  const sendMessageToClient = (msg) => chatClient.emit('message', msg);
  MessagesRepository.waitForMessage(user.id, sendMessageToClient);
});

const port = process.env.PORT || 3001;

server.listen(port, (err) => {
  if (err) throw err;
  console.log('[node-server] whatsapp api listening on port ', port);
});
