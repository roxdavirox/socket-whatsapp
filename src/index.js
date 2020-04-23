const server = require('http').createServer()
const io = require('socket.io')(server)
const WhatsAppWeb = require("../core/lib/WhatsAppWeb")

io.on('connection', function (client) {
  let clientWhatsAppWeb = new WhatsAppWeb() // instantiate
  clientWhatsAppWeb.connect();

  clientWhatsAppWeb.handlers.onConnected = () => {
    console.log('handlers connected');
  }

  clientWhatsAppWeb.handlers.onGenerateQrcode = qr => {
    // console.log('qr:', qr);
    client.emit('qrcode', qr);
  }

  clientWhatsAppWeb.handlers.onGetChats = chats => {
    // console.log('chats:', chats);
    client.emit('chats', chats);
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
  clientWhatsAppWeb.handlers.onError = (err) => console.log(err)
  clientWhatsAppWeb.handlers.onDisconnect = () => { /* internet got disconnected, save chats here or whatever; will reconnect automatically */ }

  // client.on('register', handleRegister)

  // client.on('join', handleJoin)

  // client.on('leave', handleLeave)

  client.on('message', (message) => {
    console.log('message', message);
    const { text, jid } = message;
    console.log('jid', jid);
    clientWhatsAppWeb.sendTextMessage(jid, text);
  })

  // client.on('chatrooms', handleGetChatrooms)

  // client.on('availableUsers', handleGetAvailableUsers)
  console.log('[socket-wp] connected!')
  client.on('disconnect', function () {
    console.log('client disconnect...', client.id)
    handleDisconnect()
  })

  client.on('error', function (err) {
    console.log('received error from client:', client.id)
    console.log(err)
  })
})

const port = process.env.PORT || 3001

server.listen(port, function (err) {
  if (err) throw err
  console.log('whatsapp socket listening on port 3001')
})