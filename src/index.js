const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const server = require('http').Server(app);
const io = require('socket.io')(server);

const jwtAuth = require('socketio-jwt-auth');
const config = require('./config.json');
const WhatsAppWeb = require("../core/lib/WhatsAppWeb");
const SharedSession = require('./app/session/SharedSession');
const ContactsRepository = require('./app/repositories/contactsRepository');
const ChatsRepository = require('./app/repositories/chatsRepository');
const MessagesRepository = require('./app/repositories/messagesRepository');
const QrcodeRepository = require('./app/repositories/qrcodesRepository');

global.connection = null;
const dbContext = require('./app/data');

dbContext.then(conn => { 
  global.connection = conn;
  console.log('[rethinkDb] - connected');
});

// inject deps
require('./app/controllers')({
  app,
  connection: global.connection
});

io.use(jwtAuth.authenticate({
  secret: config.jwt.secret,    // required, used to verify the token's signature
  algorithm: 'HS256'        // optional, default to be HS256
}, function(payload, done) {
  // done is a callback, you can use it as follows
  console.log('[auth-socket] checking token');
  console.log('[qrcode-socket] payload', payload);
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

qrcodeSocket.on('connection', function(qrcodeClient) {
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

  if (sessionExists) {
    console.log('[qrcode-socket] session alredy exists');
    return;
  }

  let whatsAppWeb = sharedSessions.createSession(new WhatsAppWeb(), user.id);
  
  console.log('[qrcode-socket] new connection');

  QrcodeRepository
    .getAuthQrcodeInfoByOwnerId(user.id)
    .then(qrcode => {
      if (!qrcode || !qrcode.isConnected) {
        whatsAppWeb.connect(); // start a new session, with QR code scanning and what not
        console.log('[qrcode-socket] ready to scan QRCODE', qrcode);
        return qrcode; 
      }
      const { authInfo } = qrcode;
      whatsAppWeb.login(authInfo);
      console.log('[qrcode-socket] qrcode connected successfuly');
      return qrcode;
    })
    .catch(console.error);

  qrcodeClient.on('import-contacts', function(contacts) {
    const contactsWithValidJid = contacts.map(contact => ({
      ...contact,
      jid: contact.jid.replace('@c.us', '@s.whatsapp.net')
    }));

    ContactsRepository.addContacts(contactsWithValidJid);
  });

  whatsAppWeb.handlers.onConnected = () => {
    // get all the auth info we need to restore this session
    const authInfo = whatsAppWeb.base64EncodedAuthInfo() 
    console.log('[qrcode-socket] storing qrcode auth info');
    console.log('[qrcode-socket] authInfo', authInfo);
    QrcodeRepository.storeQrcodeAuthInfo(authInfo, user.id);
    console.log('[qrcode-socket] qrcode auth info stored successfuly');
  }

  // verificar se o contato existe antes de armazenar a mensagem
  // caso não exista. cria o contato e associa com o numero do ADM
  // é possivel pegar o numero do adm pelo user logado - apenas adms chegam aqui
  // ao criar o contato - criar um chat e associar o contato com o adm
  // - caso  o contato ja exista - verificar se existe algum chat
  // caso nao exista cria um novo(associando o contato com o adm)
  whatsAppWeb.onNewMessage = async message => {
    if (message.key.fromMe || !message.key) return;
    const isGroup = message.key.remoteJid.includes('-');
    const isStatus = message.key.remoteJid.includes('status');
    if(message.key.remoteJid && (isStatus || isGroup)) return;
    console.log('nova mensagem do whatsapp:', message);

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
        short: phone
      };
      const contactId = await ContactsRepository.addContact(contact);

      const chatId = await ChatsRepository.addChat({
        userId: user.id,
        ownerId: user.id,
        contactId
      });
    }
    MessagesRepository.addNewMessageFromWhatsApp(remoteJid, message);
  }

  whatsAppWeb.handlers.onReceiveContacts = async contacts => {
    const contactsWithPicture = await Promise.all(
      contacts.map(async contact => {
        const result = await whatsAppWeb.query(['query', 'ProfilePicThumb', contact.jid]);
        if (!result.eurl) return contact;
        const { eurl } = result;
        return {
          ...contact,
          eurl
        }
    }));
    qrcodeClient.emit('adm-contacts', contactsWithPicture);
  }

  whatsAppWeb.handlers.onGenerateQrcode = qr => {
    qrcodeClient.emit('qrcode', qr);
  }

  whatsAppWeb.handlers.onError = (err) => {
    console.error(err);
  }
  whatsAppWeb.handlers.onDisconnect = () => { 
    console.log('[qrcode-socket] whatsapp disconnected');
  }
});

chatSocket.on('connection', function(chatClient) {
  console.log('[qrcode-socket] new connection');
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
  const whatsAppWeb = sharedSessions.getSession(ownerId);

  chatClient.on('disconnect', function () {
    console.log('client disconnect...', chatClient.id)
    chatClient.disconnect();
  });

  chatClient.on('error', function (err) {
    console.log('[chat-socket] received error from client:', chatClient.id)
    console.log(err)
  });
  
  ContactsRepository.getContactsByUserId(user.id)
    .then(contacts => {
      console.log('[chat-socket] contacts', contacts);
      chatClient.emit('contacts', contacts);
      ChatsRepository.getChatsByUserId(user.id)
      .then(chats => {
        console.log('[chat-socket] chats', chats);
        chatClient.emit('chats', chats)
      });
    });
  
  // se ja tem uma instancia do qrcode conectada pega apenas os dados do banco
  chatClient.on('message', (message) => {
    // envia mensagem do front para o whatsapp
    console.log('[chat-socket] new message', message);
    const { text, jid, contactId, chatId } = message;
    if (!whatsAppWeb) return;

    const messageSent = whatsAppWeb.sendTextMessage(jid, text);

    const messageToStore = {
      ownerId,
      userId: user.id,
      contactId, 
      chatId,
      time: message.time, 
      ...messageSent
    };

    MessagesRepository.addNewMessageFromClient(messageToStore);
    console.log('[chat-socket] mensagem enviada');
  });

  const sendMessageToClient = msg => chatClient.emit('message', msg);
  MessagesRepository.waitForMessage(user.id, sendMessageToClient);
})

const port = process.env.PORT || 3001

server.listen(port, function (err) {
  if (err) throw err
  console.log('[node-server] whatsapp api listening on port ', port)
})