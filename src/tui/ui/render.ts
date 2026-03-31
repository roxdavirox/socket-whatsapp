import type { Widgets } from './layout.js'
import type { AppState } from '../state/store.js'
import { selectedChat, currentMessages, chatDisplayName } from '../state/selectors.js'
import { formatMessageLine, connectionLabel, truncate } from '../utils/format.js'
import { colors } from './theme.js'
import type { Screen } from './screen.js'

const renderStatusBar = (w: Widgets, state: AppState) => {
  const user = state.auth ? `${state.auth.user.name} <${state.auth.user.email}>` : 'Not logged in'
  const conn = connectionLabel(state.connection)
  const err = state.error ? ` {red-fg}| ${state.error}{/red-fg}` : ''
  const chatCount = `${state.chats.length} chats`
  w.statusBar.setContent(` ${conn}  |  ${user}  |  ${chatCount}${err}`)
}

const renderChatList = (w: Widgets, state: AppState) => {
  const items = state.chats.map((chat, i) => {
    const name = truncate(chatDisplayName(state, chat), 25)
    const status = chat.status === 'open' ? '{green-fg}*{/green-fg}' : ' '
    const prefix = i === state.selectedChatIndex ? '{bold}>{/bold}' : ' '
    return ` ${prefix} ${status} ${name}`
  })

  w.chatList.setItems(items as never)
  w.chatList.select(state.selectedChatIndex)

  const focused = state.activePanel === 'chat-list'
  w.chatList.style.border = { fg: focused ? colors.borderFocus : colors.border }
  w.chatList.setLabel(focused ? ' {green-fg}Chats{/green-fg} ' : ' Chats ')
}

const renderMessages = (w: Widgets, state: AppState) => {
  const chat = selectedChat(state)
  const msgs = currentMessages(state)

  if (!chat) {
    w.messageThread.setContent('{center}{gray-fg}No chat selected{/gray-fg}{/center}')
    return
  }

  const name = chatDisplayName(state, chat)
  const lines = msgs.map(m => formatMessageLine(m.direction, m.text, m.timestamp))
  w.messageThread.setContent(lines.join('\n'))

  const focused = state.activePanel === 'messages'
  w.messageThread.style.border = { fg: focused ? colors.borderFocus : colors.border }
  w.messageThread.setLabel(focused ? ` {green-fg}${name}{/green-fg} ` : ` ${name} `)

  if (state.scrollOffset === -1) {
    w.messageThread.setScrollPerc(100)
  }
}

const renderInputBar = (w: Widgets, state: AppState) => {
  const focused = state.activePanel === 'input'
  w.inputBar.style.border = { fg: focused ? colors.borderFocus : colors.border }
  w.inputBar.setLabel(focused
    ? ' {green-fg}Type message (Enter=send, Esc=cancel){/green-fg} '
    : ' Message (i to type) ',
  )
}

const renderQrOverlay = (w: Widgets, state: AppState) => {
  if (state.connection === 'qr_pending' && state.qrCode) {
    w.qrOverlay.setContent(`{center}${state.qrCode}{/center}`)
    w.qrOverlay.show()
  } else {
    w.qrOverlay.hide()
  }
}

export const renderState = (screen: Screen, widgets: Widgets, state: AppState) => {
  renderStatusBar(widgets, state)
  renderChatList(widgets, state)
  renderMessages(widgets, state)
  renderInputBar(widgets, state)
  renderQrOverlay(widgets, state)
  screen.render()
}
