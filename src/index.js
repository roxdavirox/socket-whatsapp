const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
const server = require('http').Server(app);
const io = require('socket.io')(server)
const config = require('./config.json');
const r = require('rethinkdb');
const WhatsAppWeb = require("../core/lib/WhatsAppWeb")
const fs = require('fs');
const db = { ...config.rethinkdb, db: 'whats' };
var connection = null;
var isConnected = false;
global.hasWhatsappSocket = false;
global.client = null;

r.connect(db)
  .then(conn => { connection = conn });

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

    r.table('contacts')
      .filter({ userId: userData.id })
      .run(connection).then((cursor) => {
        cursor.toArray((e, contacts) => {
          client.emit('contacts', contacts)
        });;
      });

    r.table('chats')
      .filter(r.row('userId')
      .eq(userData.id))
      .run(connection).then(cursor =>{
        cursor.toArray((err, chats) => {
          client.emit('chats', chats);
        });
      });

    if (isConnected) {
      // se ja tem uma instancia do qrcode conectada pega apenas os dados do banco
      client.on('message', (message) => {
        // envia mensagem do front para o whatsapp
        console.log('message', message);
        const { text, jid, contactId } = message;
        // TODO: buscar chat id de acordo com o id do contato
        if (!global.client) return;
        const messageSent = global.client.sendTextMessage(jid, text);
        r.table('messages').insert({
          ownerId: userData.ownerId,
          userId: userData.id,
          contactId, 
          chatId: '1d339707-076d-4659-8147-dd6f84876f66',
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
      clientWhatsAppWeb.onNewMessage = message => {
        console.log('nova mensagem do whatsapp:', message);
        if (message.key.fromMe) return;
        if(message.key.remoteJid && message.remoteJid.includes('status')) return;

        r.table('contacts').filter({ jid: message.key.remoteJid })
          .run(connection).then((cursor) => {
            cursor.toArray((e, contacts) => {
              const [currentContact] = contacts;
              if (!currentContact) return;
              const newMessage = {
                ownerId: currentContact.ownerId,
                contactId: currentContact.id, 
                userId: currentContact.userId,
                chatId: '1d339707-076d-4659-8147-dd6f84876f66',
                ...message
              };
              r.table('messages').insert(newMessage).run(connection);
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