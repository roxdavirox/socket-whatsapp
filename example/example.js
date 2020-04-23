const WhatsAppWeb = require("../WhatsAppWeb")
const fs = require("fs")

let client = new WhatsAppWeb() // instantiate
try {
    const file = fs.readFileSync("auth_info.json") // load a closed session back if it exists
    const authInfo = JSON.parse(file)
    client.login( authInfo ) // log back in using the info we just loaded
} catch {
    // if no auth info exists, start a new session
    client.connect() // start a new session, with QR code scanning and what not
}
// called once the client connects successfully to the WhatsApp servers
client.handlers.onConnected = () => {
    const authInfo = client.base64EncodedAuthInfo() // get all the auth info we need to restore this session
    fs.writeFileSync("auth_info.json", JSON.stringify(authInfo, null, "\t")) // save this info to a file
    /* 
        Note: one can take this file and login again from any computer without having to scan the QR code, and get full access to one's WhatsApp 
        Despite the convenience, be careful with this file
    */
}

client.handlers.onGetChats = chats => {
    console.log('chats:', chats);
}

// called when someone's presence is updated
client.handlers.presenceUpdated = (id, type) => {
    console.log("presence of " + id + " is " + type)
}
// called when you have a pending unread message or recieve a new message
client.handlers.onUnreadMessage = (m) => { 
    // console.log("recieved message: " + JSON.stringify(m)) // uncomment to see what the raw message looks like

    const messageType = client.getMessageType(m.message) // get what type of message it is -- text, image, video
    console.log("got message of type: " + messageType)

    if (messageType === WhatsAppWeb.MessageType.text) { // if it is plain text
        const text = m.message.conversation
        console.log (m.key.remoteJid + " sent: " + text)
        client.sendMessage(m.key.remoteJid, text);
    } else if (messageType === WhatsAppWeb.MessageType.extendedText) { // if it is a quoted thing
        const text =  m.message.extendedTextMessage.text // the actual text
        client.sendMessage(m.key.remoteJid, text);
        console.log('enviando:', text);
        if (!m.message.extendedTextMessage.contextInfo) return;
        const quotedMessage = m.message.extendedTextMessage.contextInfo.quotedMessage // message that was replied to
        console.log (m.key.remoteJid + " sent: " + text + " and quoted a " + client.getMessageType(quotedMessage))
    
    } else { // if it is a media (audio, image, video) message
        // decode, decrypt & save the media. 
        // The extension to the is applied automatically based on the media type
        client.decodeMediaMessage(m.message, "media_in_" + m.key.id)
        .then (meta => {
            console.log(m.key.remoteJid + " sent media, saved at: " + meta.fileName)
            const info = {
                gif: true,  // the video is a gif
                caption: meta.fileName // the caption
            }
            const buffer = fs.readFileSync("./"+ meta.file) // load the gif
            client.sendMediaMessage (m.key.remoteJid, buffer, WhatsAppWeb.MessageType.image, info) // send this gif!

        })
        .catch (err => console.log("error in decoding message: " + err))
    }
    console.log("responding...")

    /* send a message after at least a 1 second timeout after recieving a message, otherwise WhatsApp will reject the message otherwise */
    setTimeout(() => client.sendReadReceipt(m.key.remoteJid, m.key.id), 2*1000) // send a read reciept for the message in 2 seconds
    setTimeout(() => client.updatePresence(m.key.remoteJid, WhatsAppWeb.Presence.composing), 2.5*1000) // let them know you're typing in 2.5 seconds
    setTimeout(() => {
        if (Math.random() > 0.5) { // choose at random
            client.sendTextMessage(m.key.remoteJid, m.message.conversation, m) // send a "hello!" & quote the message recieved
        } else {
            console.log('enviar gif');
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
client.handlers.onError = (err) => console.log(err)
client.handlers.onDisconnect = () => { /* internet got disconnected, save chats here or whatever; will reconnect automatically */ }

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
})
readline.question("type exit to disconnect\n", (txt) => {
    if (txt === "exit") {
        client.close()
        process.exit(0)
    }
})