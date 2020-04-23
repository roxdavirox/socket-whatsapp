const server = require('http').createServer()
const io = require('socket.io')(server)

io.on('connection', function (client) {
  // client.on('register', handleRegister)

  // client.on('join', handleJoin)

  // client.on('leave', handleLeave)

  // client.on('message', handleMessage)

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

server.listen(3001, function (err) {
  if (err) throw err
  console.log('whatsapp socket listening on port 3001')
})