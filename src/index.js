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
const createContactRepository = require('./app/repositories/contactsRepository');
const createChatRepository = require('./app/repositories/chatsRepository');

var isConnected = false;
global.hasWhatsappSocket = false;
global.client = null;
global.connection = null;
const dbContext = require('./app/data');

var connection = null;

dbContext.then(conn => { 
  global.connection = conn;
  console.log('global.connection', global.connection);
  console.log('[rethinkDb] - connected');
});

// inject deps
require('./app/controllers')({
  app,
  connection: global.connection
});

const ContactsRepository = createContactRepository({
  connection: global.connection
});

const ChatsRepository = createChatRepository({
  connection: global.connection
});

io.use(jwtAuth.authenticate({
  secret: config.jwt.secret,    // required, used to verify the token's signature
  algorithm: 'HS256'        // optional, default to be HS256
}, function(payload, done) {
  // done is a callback, you can use it as follows
  console.log('payload', payload);
}));

io.on('connection', function (client) {
  client.on('userdata', function(userData) {
    // recebe os dados do usuário na conexão para gerenciar o monitoramento
    // TODO: utilizar token de conexão do jwt para pegar as informações

    let clientWhatsAppWeb = new WhatsAppWeb(); // instantiate
    console.log('[socket-wp] connected!');
    client.on('disconnect', function () {
      console.log('client disconnect...', client.id)
      client.disconnect();
    });

    client.on('error', function (err) {
      console.log('[socket-wp] received error from client:', client.id)
      console.log(err)
    });
    
    ContactsRepository.getContactsByUserId(userData.id)
      .then(contacts => {
        console.log('contacts', contacts);
        client.emit('contacts', contacts)
      });
    
    ChatsRepository.getChatsByUserId(userData.id)
      .then(chats => {
        console.log('chatas', chats);
        client.emit('chats', chats)
      });
    
    if (isConnected) {
      // se ja tem uma instancia do qrcode conectada pega apenas os dados do banco
      client.on('message', (message) => {
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

    } else {
      // primeira conexão com qrcode
      // try {
      //   const file = fs.readFileSync("auth_info.json") // load a closed session back if it exists
      //   const authInfo = JSON.parse(file);
      //   // console.log('authInfo', authInfo);
      //   clientWhatsAppWeb.login(authInfo); // log back in using the info we just loaded
        
      // } catch {
      //   // if no auth info exists, start a new session
      // }
      clientWhatsAppWeb.connect(); // start a new session, with QR code scanning and what not

      isConnected = true;

      client.on('import-contacts', function(contacts) {
        const contactsWithValidJid = contacts.map(contact => ({
          ...contact,
          jid: contact.jid.replace('@c.us', '@s.whatsapp.net')
        }))
        r.table('contacts').insert(contactsWithValidJid).run(connection);
      });

      clientWhatsAppWeb.handlers.onConnected = () => {
        if (!global.hasWhatsappSocket) {
          global.client = clientWhatsAppWeb;
          global.hasWhatsappSocket = true;
        }
        
        console.log('[socket] handlers connected');
        const authInfo = clientWhatsAppWeb.base64EncodedAuthInfo() // get all the auth info we need to restore this session
        fs.writeFileSync("auth_info.json", JSON.stringify(authInfo, null, "\t")) // save this info to a file
        /* 
          Note: one can take this file and login again from any computer without having to scan the QR code, and get full access to one's WhatsApp 
          Despite the convenience, be careful with this file
        */
      }

      // cada client deve enviar os dados do usuario
      // contato chat e o dono da conta através da mensagem
      clientWhatsAppWeb.onNewMessage = async message => {
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

      clientWhatsAppWeb.handlers.onReceiveContacts = async contacts => {
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
        client.emit('adm-contacts', contactsWithPicture);
      }

      clientWhatsAppWeb.handlers.onGenerateQrcode = qr => {
        // console.log('qr:', qr);
        client.emit('qrcode', qr);
      }
      // called when someone's presence is updated
      clientWhatsAppWeb.handlers.presenceUpdated = (id, type) => {
        console.log("presence of " + id + " is " + type)
      }
      // called when you have a pending unread message or recieve a new message
      clientWhatsAppWeb.handlers.onUnreadMessage = (m) => { 
        // console.log("recieved message: " + JSON.stringify(m)) // uncomment to see what the raw message looks like

        const messageType = clientWhatsAppWeb.getMessageType(m.message) // get what type of message it is -- text, image, video
        console.log("got message of type: " + messageType)

        if (messageType === WhatsAppWeb.MessageType.text) { // if it is plain text
          const text = m.message.conversation
          // console.log ("mensagem enviada: JID ", m.key.remoteJid + "  " + text)
          // clientWhatsAppWeb.sendTextMessage(m.key.remoteJid, text);
          client.emit('message', {
            jid: m.key.remoteJid,
            text
          });
        } else if (messageType === WhatsAppWeb.MessageType.extendedText) { // if it is a quoted thing
          const text =  m.message.extendedTextMessage.text // the actual text
          // clientWhatsAppWeb.sendMessage(m.key.remoteJid, text);
          console.log('enviando:', text);
          if (!m.message.extendedTextMessage.contextInfo) return;
          const quotedMessage = m.message.extendedTextMessage.contextInfo.quotedMessage // message that was replied to
          console.log (m.key.remoteJid + " sent: " + text + " and quoted a " + clientWhatsAppWeb.getMessageType(quotedMessage))
        
        } else { // if it is a media (audio, image, video) message
          // decode, decrypt & save the media. 
          // The extension to the is applied automatically based on the media type
          // clientWhatsAppWeb.decodeMediaMessage(m.message, "media_in_" + m.key.id)
          // .then (meta => {
          //   console.log(m.key.remoteJid + " sent media, saved at: " + meta.fileName)
          //   const info = {
          //     gif: true,  // the video is a gif
          //     caption: meta.fileName // the caption
          //   }
          //   const buffer = fs.readFileSync("./"+ meta.file) // load the gif
          //   // clientWhatsAppWeb.sendMediaMessage (m.key.remoteJid, buffer, WhatsAppWeb.MessageType.image, info) // send this gif!

          // })
          // .catch (err => console.log("error in decoding message: " + err))
        }

        /* send a message after at least a 1 second timeout after recieving a message, otherwise WhatsApp will reject the message otherwise */
        setTimeout(() => clientWhatsAppWeb.sendReadReceipt(m.key.remoteJid, m.key.id), 2*1000) // send a read reciept for the message in 2 seconds
        setTimeout(() => clientWhatsAppWeb.updatePresence(m.key.remoteJid, WhatsAppWeb.Presence.composing), 2.5*1000) // let them know you're typing in 2.5 seconds
        setTimeout(() => {
            if (Math.random() > 0.5) { // choose at random
              // clientWhatsAppWeb.sendTextMessage(m.key.remoteJid, m.message.conversation, m) // send a "hello!" & quote the message recieved
            } else {
              console.log('envia gif');
              // const buffer = fs.readFileSync("./hello.mp4") // load the gif
              // const info = {
              //     gif: true,  // the video is a gif
              //     caption: "Bom dia XD" // the caption
              // }
              // client.sendMediaMessage (m.key.remoteJid, buffer, WhatsAppWeb.MessageType.video, info) // send this gif!
            }
        }, 4*1000) // send after 4 seconds
      }

      // called if an error occurs
      clientWhatsAppWeb.handlers.onError = (err) => {
        console.log(err);
      }
      clientWhatsAppWeb.handlers.onDisconnect = () => { /* internet got disconnected, save chats here or whatever; will reconnect automatically */ }
    }
  });
  
})

const port = process.env.PORT || 3001

server.listen(port, function (err) {
  if (err) throw err
  console.log('[node-server] whatsapp socket listening on port ', port)
})