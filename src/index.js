const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
const server = require('http').Server(app);
const io = require('socket.io')(server)
const jwtAuth = require('socketio-jwt-auth');
const config = require('./config.json');
const WhatsAppWeb = require("../core/lib/WhatsAppWeb")
const fs = require('fs');
const ContactsRepository = require('./app/repositories/contactsRepository');
const ChatsRepository = require('./app/repositories/chatsRepository');

var isConnected = false;
global.hasWhatsappSocket = false;
global.client = null;
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
  console.log('payload', payload);
  const { user } = payload;
  if (!user) {
    console.log('user not found at token');
    return done(null, false, 'user not found at token');
  }
  return done(null, user);
}));

// TODO: separar os tipos de conexões
const qrcodeSocket = io.of('qrcode');
const chatSocket = io.if('chat');

qrcodeSocket.on('connection', function(qrCodeClient) {
  console.log('[qrcode-socket] new connection');
  let whatsAppWeb = new WhatsAppWeb(); // instantiate
  // primeira conexão com qrcode
  // try {
  //   const file = fs.readFileSync("auth_info.json") // load a closed session back if it exists
  //   const authInfo = JSON.parse(file);
  //   // console.log('authInfo', authInfo);
  //   clientWhatsAppWeb.login(authInfo); // log back in using the info we just loaded
    
  // } catch {
  //   // if no auth info exists, start a new session
  // }
  whatsAppWeb.connect(); // start a new session, with QR code scanning and what not

  isConnected = true;

  qrCodeClient.on('import-contacts', function(contacts) {
    const contactsWithValidJid = contacts.map(contact => ({
      ...contact,
      jid: contact.jid.replace('@c.us', '@s.whatsapp.net')
    }))
    r.table('contacts').insert(contactsWithValidJid).run(connection);
  });

  whatsAppWeb.handlers.onConnected = () => {
    if (!global.hasWhatsappSocket) {
      global.client = whatsAppWeb;
      global.hasWhatsappSocket = true;
    }
    
    console.log('[socket] handlers connected');
    const authInfo = whatsAppWeb.base64EncodedAuthInfo() // get all the auth info we need to restore this session
    fs.writeFileSync("auth_info.json", JSON.stringify(authInfo, null, "\t")) // save this info to a file
    /* 
      Note: one can take this file and login again from any computer without having to scan the QR code, and get full access to one's WhatsApp 
      Despite the convenience, be careful with this file
    */
  }

  // cada client deve enviar os dados do usuario
  // contato chat e o dono da conta através da mensagem
  whatsAppWeb.onNewMessage = async message => {
    console.log('nova mensagem do whatsapp:', message);
    if (message.key.fromMe || !message.key) return;
    if(message.key.remoteJid && message.key.remoteJid.includes('status')) return;

    r.table('contacts').filter({ jid: message.key.remoteJid })
      .run(connection).then((cursor) => {
        cursor.toArray((e, contacts) => {
          const [currentContact] = contacts;
          if (!currentContact) return;
          r.table('chats').filter({ contactId: currentContact.id })
            .run(connection)
            .then(chatCursor => {
              chatCursor.toArray((e, chats) => {
                const [chat] = chats;
                if (!chat) return;
                const newMessage = {
                  ownerId: currentContact.ownerId,
                  contactId: currentContact.id, 
                  userId: currentContact.userId,
                  chatId: chat.id,
                  time: new Date(),
                  ...message
                };
                r.table('messages').insert(newMessage).run(connection);
              });
            });
        });;
    });       
  }

  whatsAppWeb.handlers.onReceiveContacts = async contacts => {
    const contactsWithPicture = await Promise.all(
      contacts.map(async contact => {
        const result = await global.client.query(['query', 'ProfilePicThumb', contact.jid]);
        if (!result.eurl) return contact;
        const { eurl } = result;
        return {
          ...contact,
          eurl
        }
    }));
    qrCodeClient.emit('adm-contacts', contactsWithPicture);
  }

  whatsAppWeb.handlers.onGenerateQrcode = qr => {
    // console.log('qr:', qr);
    qrCodeClient.emit('qrcode', qr);
  }

  // called if an error occurs
  whatsAppWeb.handlers.onError = (err) => {
    console.log(err);
  }
  whatsAppWeb.handlers.onDisconnect = () => { /* internet got disconnected, save chats here or whatever; will reconnect automatically */ }
});


// O qrcode já deve estar conectado para o usuário poder acessar o chat
chatSocket.on('connection', function(chatClient) {
  console.log('[qrcode-socket] new connection');
  const { user } = chatSocket.request;

  if (!user) {
    console.log('[chat-socket] no user provided');
    chatClient.disconnect();
    return;
  }

  chatClient.on('disconnect', function () {
    console.log('client disconnect...', chatClient.id)
    chatClient.disconnect();
  });

  chatClient.on('error', function (err) {
    console.log('[socket-wp] received error from client:', chatClient.id)
    console.log(err)
  });
  
  ContactsRepository.getContactsByUserId(userData.id)
    .then(contacts => {
      console.log('contacts', contacts);
      chatClient.emit('contacts', contacts)
    });
  
  ChatsRepository.getChatsByUserId(userData.id)
    .then(chats => {
      console.log('chatas', chats);
      chatClient.emit('chats', chats)
    });

  // se ja tem uma instancia do qrcode conectada pega apenas os dados do banco
  chatClient.on('message', (message) => {
    // envia mensagem do front para o whatsapp
    console.log('message', message);
    const { text, jid, contactId, chatId } = message;
    // TODO: buscar chat id de acordo com o id do contato
    if (!global.client) return;
    const messageSent = global.client.sendTextMessage(jid, text);
    r.table('messages').insert({
      ownerId: userData.ownerId,
      userId: userData.id,
      contactId, 
      chatId,
      time: message.time, 
      ...messageSent
    }).run(connection);
  });
  if (global.client){
    client.emit('userdata', global.client.getUserMetadata());
    // console.log('data user', global.client.getUserMetadata());
  }

  r.table('messages')
    .filter(r.row('userId').eq(userData.id))
    .changes()
    .run(connection)
    .then(cursor => {
      cursor.each((err, data) => {
        // console.log('data:', data);
        const message = data.new_val;
        client.emit('message', message);
      });
  });
})

const port = process.env.PORT || 3001

server.listen(port, function (err) {
  if (err) throw err
  console.log('[node-server] whatsapp socket listening on port ', port)
})