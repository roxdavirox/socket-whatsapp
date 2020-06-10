const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

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

dbContext.then((conn) => {
  global.connection = conn;
  console.log('[rethinkDb] - connected');
});

// inject deps
require('./app/controllers')({
  app,
  connection: global.connection,
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

const sharedSessions = new SharedSession();

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
    console.log('[qrcode-socket] session alredy exists');
    qrcodeClient.emit('qrcodeStatusConnection', qrcodeConnected);
    if (qrcodeConnected) return;
    sharedSessions.getSession(user.id).close();
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

  whatsAppWeb.handlers.onConnected = () => {
    // get all the auth info we need to restore this session
    const authInfo = whatsAppWeb.base64EncodedAuthInfo();
    if (!qrcodeConnected) {
      console.log('[qrcode-socket] storing qrcode auth info');
      QrcodeRepository.storeQrcodeAuthInfo(authInfo, user.id);
      console.log('[qrcode-socket] qrcode auth info stored successfuly');
    }
    console.log('[qrcode-socket] whatsapp onConnected event');
    qrcodeSocket.emit('qrcodeStatusConnection', true);
  };

  whatsAppWeb.onNewMessage = async (message) => {
    if (message.key.fromMe || !message.key) return;
    const isGroup = message.key.remoteJid.includes('-');
    const isStatus = message.key.remoteJid.includes('status');
    // eslint-disable-next-line no-prototype-builtins
    if (message.key.remoteJid && (isStatus || isGroup)) return;
    const isImage = message.message.hasOwnProperty('imageMessage');
    if (isImage) {
      console.log('[qrcode-socket] Imagem recebida');
      whatsAppWeb.decodeMediaMessage(message.message, 'teste');
    }
    console.log('nova mensagem do whatsapp:', message);
    const time = new Date();

    const { remoteJid } = message.key;
    const contactExists = await ContactsRepository.contactExistsByJid(remoteJid);

    if (!contactExists) {
      const phone = remoteJid.split('@')[0];
      const contact = {
        jid: remoteJid,
        ownerId: user.id,
        userId: user.id,
        phone,
        name: phone,
        short: phone,
      };
      const contactId = await ContactsRepository.addContact(contact);

      // eslint-disable-next-line no-unused-vars
      const chatId = await ChatsRepository.addChat({
        userId: user.id,
        ownerId: user.id,
        contactId,
        lastMessageTime: time,
      });
    }
    const contact = await ContactsRepository.getContactByRemoteJid(remoteJid);
    if (!contact) return;
    ChatsRepository.updateByContactId(contact.id, { lastMessageTime: time });
    MessagesRepository.addNewMessageFromWhatsApp(remoteJid, {
      ...message, time,
    });
  };

  whatsAppWeb.handlers.onGenerateQrcode = (qr) => {
    qrcodeClient.emit('qrcode', qr);
  };

  whatsAppWeb.handlers.onError = (err) => {
    console.error('[whatsapp] error: ', err);
    QrcodeRepository.removeByOwnerId(user.id);
    qrcodeClient.disconnect();
    sharedSessions.removeSession(user.id);
  };

  whatsAppWeb.handlers.onDisconnect = async () => {
    console.log('[qrcode-socket] whatsapp disconnected');
    qrcodeSocket.emit('qrcodeStatusConnection', false);
    QrcodeRepository.removeByOwnerId(user.id);
    whatsAppWeb.close();
    sharedSessions.removeSession(user.id);
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

  ContactsRepository.getContactsByUserId(user.id)
    .then((contacts) => {
      chatClient.emit('contacts', contacts);
      ChatsRepository.getChatsByUserId(user.id)
        .then((chats) => {
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
    if (!whatsAppWeb) return;
    console.log('[chat-socket] new message', message);
    const {
      text, jid, contactId, chatId,
    } = message;

    const messageSent = whatsAppWeb.sendTextMessage(jid, text);
    const time = new Date();
    const messageToStore = {
      ownerId,
      userId: user.id,
      contactId,
      chatId,
      time,
      ...messageSent,
    };
    ChatsRepository.updateByContactId(contactId, { lastMessageTime: time });
    MessagesRepository.addNewMessageFromClient(messageToStore);
    console.log('[chat-socket] mensagem enviada');
  });

  chatClient.on('getContactMessages', async (data) => {
    const { contactId } = data;
    if (!contactId) return;
    const messages = await MessagesRepository.getMessagesByContactId(contactId);
    chatClient.emit('getContactMessages', {
      contactId,
      messages,
    });
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
