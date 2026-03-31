import 'dotenv/config'
import * as readline from 'node:readline'
import { isOk } from '@tecnomancy/alchemy'
import { loadTuiConfig } from './config.js'
import { createAuthStore } from './client/auth.js'
import { login, fetchChats, fetchContacts, fetchMessages } from './client/http.js'
import { createSocketClient, type SocketClient } from './client/socket.js'
import { createStore } from './state/store.js'
import { createScreen } from './ui/screen.js'
import { createLayout } from './ui/layout.js'
import { renderState } from './ui/render.js'
import { bindKeys } from './keybindings.js'

// --- interactive prompt (before blessed takes over) ---

const prompt = (question: string, hidden = false): Promise<string> =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    if (hidden) {
      process.stdout.write(question)
      const stdin = process.stdin
      stdin.setRawMode?.(true)
      let input = ''
      const onData = (char: Buffer) => {
        const c = char.toString()
        if (c === '\n' || c === '\r') {
          stdin.setRawMode?.(false)
          stdin.removeListener('data', onData)
          process.stdout.write('\n')
          rl.close()
          resolve(input)
        } else if (c === '\u007F') {
          input = input.slice(0, -1)
        } else {
          input += c
          process.stdout.write('*')
        }
      }
      stdin.on('data', onData)
    } else {
      rl.question(question, (answer) => { rl.close(); resolve(answer) })
    }
  })

// --- boot ---

const boot = async () => {
  const configResult = loadTuiConfig()
  if (!isOk(configResult)) {
    console.error('Config error:', configResult.error.message)
    process.exit(1)
  }
  const config = configResult.value

  // login
  console.log('\n  WhatsApp Agent TUI\n')
  const email = config.EMAIL ?? await prompt('  Email: ')
  const password = config.PASSWORD ?? await prompt('  Password: ', true)

  const authResult = await login(config.API_URL, email, password)
  if (!isOk(authResult)) {
    console.error('\n  Login failed:', authResult.error.message)
    process.exit(1)
  }

  console.log(`  Logged in as ${authResult.value.user.name}\n`)

  const authStore = createAuthStore()
  authStore.setToken(authResult.value.token)

  // state
  const store = createStore()
  store.dispatch({ type: 'AUTH_SUCCESS', payload: authResult.value })

  // blessed screen
  const screen = createScreen()
  const widgets = createLayout(screen)

  // socket
  let socket: SocketClient | null = null

  const loadMessages = async (chatId: string) => {
    const result = await fetchMessages(config.API_URL, authStore.getHeaders(), chatId)
    if (isOk(result)) {
      store.dispatch({ type: 'MESSAGES_LOADED', payload: { chatId, messages: result.value } })
    }
  }

  // keybindings
  bindKeys({
    screen,
    widgets,
    store,
    get socket() { return socket },
    onLoadMessages: loadMessages,
  })

  // render loop
  store.subscribe((state) => renderState(screen, widgets, state))

  // socket connection
  socket = createSocketClient(config.WS_URL, authResult.value.token)

  socket.qr.onQr((qr) => store.dispatch({ type: 'QR_RECEIVED', payload: qr }))
  socket.qr.onConnected(() => store.dispatch({ type: 'CONNECTION_CHANGED', payload: 'connected' }))
  socket.qr.onDisconnected((reason) => {
    store.dispatch({ type: 'CONNECTION_CHANGED', payload: 'disconnected' })
    store.dispatch({ type: 'ERROR', payload: `Disconnected: ${reason}` })
  })
  socket.qr.onError((msg) => store.dispatch({ type: 'ERROR', payload: msg }))

  socket.chat.onNewMessage((msg) => {
    const message = msg as { chatId: string } & Record<string, unknown>
    if (message.chatId) {
      store.dispatch({ type: 'MESSAGE_RECEIVED', payload: { chatId: message.chatId, message: msg as never } })
    }
  })

  // initial data load
  const [chatsResult, contactsResult] = await Promise.all([
    fetchChats(config.API_URL, authStore.getHeaders()),
    fetchContacts(config.API_URL, authStore.getHeaders()),
  ])

  if (isOk(chatsResult)) store.dispatch({ type: 'CHATS_LOADED', payload: chatsResult.value })
  if (isOk(contactsResult)) store.dispatch({ type: 'CONTACTS_LOADED', payload: contactsResult.value })

  // auto-load first chat messages
  if (isOk(chatsResult) && chatsResult.value.length > 0 && chatsResult.value[0]) {
    await loadMessages(chatsResult.value[0].id)
  }

  // connect whatsapp session
  socket.qr.connect()
  store.dispatch({ type: 'CONNECTION_CHANGED', payload: 'connecting' })

  screen.render()
}

boot().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
