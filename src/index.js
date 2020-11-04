/* eslint-disable no-underscore-dangle */
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
        if (whatsAppWeb.status === 0) {
          // faz login quando não está conectado
          whatsAppWeb.login(authInfo);
        }

        whatsAppWeb.handlers.onConnected = async () => {
          // get all the auth info we need to restore this session
          const _authInfo = whatsAppWeb.base64EncodedAuthInfo();
          const qrcodeExists = await QrcodeRepository.qrcodeExists(qrcode.ownerId);

          if (!qrcodeExists) {
            console.log('[setup] armazenando qrcode no banco de dados pela primeira vez');
            await QrcodeRepository.storeQrcodeAuthInfo(_authInfo, qrcode.ownerId);
            console.log('[setup] auth info do qrcode armazenado com sucesso!');
          } else {
            console.log('[setup] atualizando informações de conexão do qrcode');
            await QrcodeRepository.updateAuthInfo(_authInfo, qrcode.ownerId);
            console.log('[setup] informações do qrcode atualizadas com sucesso!');
          }
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

          const isImage = message.message.hasOwnProperty('imageMessage');
          const isAudio = message.message.hasOwnProperty('audioMessage');
          const isDocument = message.message.hasOwnProperty('documentMessage');
          const isVideo = message.message.hasOwnProperty('videoMessage');

          if (isImage || isAudio || isDocument || isVideo) {
            console.log('[qrcode-socket-setup] arquivo recebido');
            await whatsAppWeb.decodeMediaMessage(message.message);
          }
          console.log('[qrcode-socket-setup] nova mensagem do whatsapp:', message);
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
          ChatsRepository.updateLastTime(
            contact.id, {
              lastTextMessage: message.message.conversation || 'Nova mensagem',
              read: false,
            },
          );
          MessagesRepository.addNewMessageFromWhatsApp(remoteJid, contact.ownerId, {
            ...message, time,
          });
        };

        whatsAppWeb.handlers.onGenerateQrcode = (qr) => {
        };

        whatsAppWeb.handlers.onError = (err) => {
          const [statusError] = err;
          if (!statusError || statusError == 3) return;
          console.error('[whatsapp] error: ', err);
          QrcodeRepository.disconnectByOwnerId(qrcode.ownerId);
          if (statusError == 401 || statusError == 400 || statusError == 419) {
            console.log('[qrcode-socket-setup] status error', statusError, qrcode.ownerId);
            console.log('[error] removendo qrcode do banco de dados', qrcode.ownerId);
            // removendo o qrcode ele força próxima vez gerar o qrcode
            QrcodeRepository.removeByOwnerId(qrcode.ownerId);
          }

          if (sharedSessions.sessionExists(qrcode.ownerId)) {
            const session = sharedSessions.getSession(qrcode.ownerId);
            console.log('[qrcode-setup] fechando conexão do whatsapp socket', qrcode.ownerId);
            session.close();
            console.log('[qrcode-setup] removendo sessão', qrcode.ownerId);
            sharedSessions.removeSession(qrcode.ownerId);
          }
        };

        whatsAppWeb.handlers.onDisconnect = async () => {
          console.log('[qrcode-socket-setup] whatsapp desconectado', qrcode.ownerId);
          QrcodeRepository.disconnectByOwnerId(qrcode.ownerId);
          console.log('[qrcode-socket-setup] removendo sessão', qrcode.ownerId);
          sharedSessions.removeSession(qrcode.ownerId);
        };

        whatsAppWeb.handlers.onDisconnectFromPhone = async () => {
          console.log('[qrcode-socket-setup] desconectado pelo telefone', qrcode.ownerId);
          console.log('[qrcode-socket-setup] removendo qrcode do banco de dados', qrcode.ownerId);
          QrcodeRepository.removeByOwnerId(qrcode.ownerId);
          console.log('[qrcode-socket-setup] removendo sessão', qrcode.ownerId);
          sharedSessions.removeSession(qrcode.ownerId);
        };

        whatsAppWeb.handlers.onKeepAliveDisconnect = async () => {
          console.log('[qrcode-socket] onKeepAliveDisconnect (setup)');
          sharedSessions.removeSession(qrcode.ownerId);
          QrcodeRepository.disconnectByOwnerId(qrcode.ownerId);
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
    qrcodeClient.disconnect();
    return;
  }

  console.log('[qrcode-socket] usuário conectado', user.email, '-', user.name);

  if (user.role !== 'ADMIN') {
    console.log('[qrcode-socket] usuário não é ADM - acesso negado.');
    qrcodeClient.disconnect();
    return;
  }

  const sessionExists = sharedSessions.sessionExists(user.id);
  const qrcodeConnected = await QrcodeRepository.getQrcodeStatusByOwnerId(user.id);

  if (sessionExists) {
    console.log('[qrcode-socket] sessão do whatsapp já existe', user.email);
    qrcodeClient.emit('qrcodeStatusConnection', qrcodeConnected);
    const currentSession = sharedSessions.getSession(user.id);
    const sessionIsConnected = currentSession.status === 5;
    const sessionIsLogging = currentSession.status === 4;
    console.log('[qrcode-socket] status da conexão: ', currentSession.status);
    console.log('[qrcode-socket] sessão está conectada:', sessionIsConnected);
    if ((qrcodeConnected && sessionIsConnected) || sessionIsLogging || currentSession.isSleeping) {
      console.log('[qrcode-socket] desconectando socket qrcode');
      qrcodeClient.disconnect();
      return;
    }
    const whatsAppweb = sharedSessions.getSession(user.id);
    console.log('[qrcode-socket] fechando sessão anterior', user.email);

    if (whatsAppweb) {
      console.log('[qrcode-socket] fechando conexão do whatsapp socket', user.id);
      whatsAppweb.close();

      console.log('[qrcode-socket] removendo sessão anterior', user.email);
      sharedSessions.removeSession(user.id);
    }
  }

  const whatsAppWeb = sharedSessions.createSession(new WhatsAppWeb(), user.id);

  QrcodeRepository
    .getAuthQrcodeInfoByOwnerId(user.id)
    .then((qrcode) => {
      // start a new session, with QR code scanning and what not
      if (!qrcode) {
        whatsAppWeb.connect();
        console.log('[qrcode-socket] ready to scan QRCODE', qrcode);
        return qrcode;
      }
      const { authInfo } = qrcode;
      if (whatsAppWeb.status === 0) {
        whatsAppWeb.login(authInfo);
        console.log('[qrcode-socket] qrcode connectad successfuly');
        setTimeout(() => qrcodeClient.emit('qrcodeStatusConnection', true), 2000);
      }

      return qrcode;
    })
    .catch(console.error);

  whatsAppWeb.handlers.onConnected = async () => {
    // get all the auth info we need to restore this session
    const authInfo = whatsAppWeb.base64EncodedAuthInfo();
    const qrcodeExists = await QrcodeRepository.qrcodeExists(user.id);

    if (!qrcodeExists) {
      console.log('[qrcode-socket] armazenando qrcode no banco de dados pela primeira vez');
      await QrcodeRepository.storeQrcodeAuthInfo(authInfo, user.id);
      console.log('[qrcode-socket] auth info do qrcode armazenado com sucesso!');
    } else {
      console.log('[qrcode-socket] atualizando informações de conexão do qrcode');
      await QrcodeRepository.updateAuthInfo(authInfo, user.id);
      console.log('[qrcode-socket] informações do qrcode atualizadas com sucesso!');
    }
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
    const isVideo = message.message.hasOwnProperty('videoMessage');

    if (isImage || isAudio || isDocument || isVideo) {
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
    ChatsRepository.updateLastTime(
      contact.id, {
        lastTextMessage: message.message.conversation || 'Nova mensagem',
        read: false,
      },
    );
    MessagesRepository.addNewMessageFromWhatsApp(remoteJid, contact.ownerId, {
      ...message, time,
    });
  };

  whatsAppWeb.handlers.onGenerateQrcode = (qr) => {
    qrcodeClient.emit('qrcode', qr);
  };

  whatsAppWeb.handlers.onError = (err) => {
    const [statusError] = err;
    if (!statusError || statusError == 3) return;
    console.error('[qrcode-socket] error: ', err);

    qrcodeSocket.emit('qrcodeStatusConnection', false);

    QrcodeRepository.disconnectByOwnerId(user.id);
    if (statusError == 401 || statusError == 400 || statusError == 419) {
      console.log('[qrcode-socket] Erro - removendo qrcode do banco de dados. status:', statusError);
      // removendo o qrcode ele força próxima vez gerar o qrcode
      QrcodeRepository.removeByOwnerId(user.id);
      // envia status de erro para o front atualizar o qrcode container
      qrcodeSocket.emit('status-error', statusError);
    }
    if (sharedSessions.sessionExists(user.id)) {
      const session = sharedSessions.getSession(user.id);
      console.log('[qrcode-socket] fechando conexão do whatsapp socket', user.id);
      session.close();
      console.log('[qrcode-socket] removendo sessão', user.id);
      sharedSessions.removeSession(user.id);
    }
    qrcodeClient.disconnect();
  };

  whatsAppWeb.handlers.onKeepAliveDisconnect = async () => {
    console.log('[qrcode-socket] onKeepAliveDisconnect', user.email);
    // qrcodeSocket.emit('qrcodeStatusConnection', false);
    sharedSessions.removeSession(user.id);
    QrcodeRepository.disconnectByOwnerId(user.id);
    qrcodeClient.disconnect();
  };

  whatsAppWeb.handlers.onDisconnect = async () => {
    console.log('[qrcode-socket] onDisconnect', user.email);
    qrcodeSocket.emit('qrcodeStatusConnection', false);
    sharedSessions.removeSession(user.id);
    QrcodeRepository.disconnectByOwnerId(user.id);
    qrcodeClient.disconnect();
  };

  whatsAppWeb.handlers.onDisconnectFromPhone = async () => {
    console.log('[qrcode-socket] onDisconnectFromPhone', user.email);
    qrcodeSocket.emit('qrcodeStatusConnection', false);
    console.log('[qrcode-socket] removendo a sessão - desconectado pelo celular', user.email);
    sharedSessions.removeSession(user.id);
    console.log('[qrcode-socket] removendo qrcode do banco de dados', user.name);
    QrcodeRepository.removeByOwnerId(user.id);
    console.log('[qrcode-socket] socket qrcode desconectado.');
    qrcodeClient.disconnect();
  };
});

chatSocket.on('connection', (chatClient) => {
  console.log('[chat-socket] novo chat conectando...');
  const { user } = chatClient.request;

  if (!user) {
    console.log('[chat-socket] no user provided');
    chatClient.disconnect();
    return;
  }
  console.log('[chat-socket] novo usuário conectado ao chat', user.name);

  const ownerId = user.role === 'ADMIN'
    ? user.id
    : user.ownerId;

  const hasActiveOwnerSession = sharedSessions.sessionExists(ownerId);

  if (!hasActiveOwnerSession) {
    console.log('[chat-socket] a sessão', ownerId, ' não existe', user.email);
    console.log('[chat-socket] chat socket desconectado.');
    chatClient.disconnect();
    return;
  }

  const whatsappSession = sharedSessions.getSession(ownerId);

  const isNotConnected = whatsappSession.status !== 5;
  if (isNotConnected) {
    console.log('[chat-socket] whatsapp socket não está conectado', ownerId, user.email);
    console.log('[chat-socket] chat desconectado.');
    return;
  }

  const qrcodeIsConnected = QrcodeRepository.getQrcodeStatusByOwnerId(user.ownerId);

  if (!qrcodeIsConnected) {
    console.log('[chat-socket] qrcode não encontrado no banco de dados', user.email);
    console.log('[chat-socket] chat socket desconectado.');
    chatClient.disconnect();
    return;
  }

  chatClient.join(user.id);
  chatClient.on('disconnect', () => {
    console.log('[socket-chat] client disconnect...', chatClient.id, user.name);
  });

  chatClient.on('error', (err) => {
    console.log('[chat-socket] received error from client:', chatClient.id, user.name);
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
      chatClient.emit('contacts', contacts);
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
    if (!whatsAppWeb || !whatsAppWeb.conn || whatsAppWeb.status !== 5) {
      console.log('[chat-socket] não há conexão com o whatsapp web', user.email);
      if (whatsAppWeb) whatsAppWeb.close();
      sharedSessions.removeSession(user.ownerId);
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
    ChatsRepository.updateLastTime(
      contactId, {
        lastTextMessage: messageToStore.message.conversation || 'Nova mensagem',
      },
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

    await ChatsRepository.updateByContactId(contactId, { userId, fixed: false });
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
