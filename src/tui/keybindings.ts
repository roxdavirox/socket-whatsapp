import type { Screen } from './ui/screen.js'
import type { Widgets } from './ui/layout.js'
import type { Store } from './state/store.js'
import { selectedChat, selectedChatJid } from './state/selectors.js'
import type { SocketClient } from './client/socket.js'

type BindDeps = {
  readonly screen: Screen
  readonly widgets: Widgets
  readonly store: Store
  readonly socket: SocketClient | null
  readonly onLoadMessages: (chatId: string) => void
}

export const bindKeys = ({ screen, widgets, store, socket, onLoadMessages }: BindDeps) => {
  // --- global ---
  screen.key(['q', 'C-c'], () => {
    socket?.destroy()
    process.exit(0)
  })

  screen.key(['tab'], () => store.dispatch({ type: 'CYCLE_PANEL' }))

  screen.key(['?'], () => {
    widgets.helpOverlay.toggle()
    screen.render()
  })

  screen.key(['escape'], () => {
    if (!widgets.helpOverlay.hidden) {
      widgets.helpOverlay.hide()
      screen.render()
      return
    }
    if (!widgets.qrOverlay.hidden) {
      widgets.qrOverlay.hide()
      screen.render()
      return
    }
    if (store.getState().activePanel === 'input') {
      store.dispatch({ type: 'FOCUS_PANEL', payload: 'chat-list' })
    }
  })

  // --- connect/disconnect ---
  screen.key(['c'], () => {
    if (store.getState().activePanel !== 'input') {
      socket?.qr.connect()
      store.dispatch({ type: 'CONNECTION_CHANGED', payload: 'connecting' })
    }
  })

  screen.key(['d'], () => {
    if (store.getState().activePanel !== 'input') {
      socket?.qr.disconnect()
      store.dispatch({ type: 'CONNECTION_CHANGED', payload: 'disconnected' })
    }
  })

  // --- chat list navigation ---
  screen.key(['j', 'down'], () => {
    if (store.getState().activePanel === 'chat-list') {
      store.dispatch({ type: 'NAVIGATE_CHAT', payload: 'down' })
    }
    if (store.getState().activePanel === 'messages') {
      store.dispatch({ type: 'SCROLL', payload: 'down' })
    }
  })

  screen.key(['k', 'up'], () => {
    if (store.getState().activePanel === 'chat-list') {
      store.dispatch({ type: 'NAVIGATE_CHAT', payload: 'up' })
    }
    if (store.getState().activePanel === 'messages') {
      store.dispatch({ type: 'SCROLL', payload: 'up' })
    }
  })

  screen.key(['enter'], () => {
    const state = store.getState()
    if (state.activePanel === 'chat-list') {
      const chat = selectedChat(state)
      if (chat) onLoadMessages(chat.id)
    }
  })

  screen.key(['g'], () => {
    if (store.getState().activePanel === 'messages') {
      store.dispatch({ type: 'SCROLL', payload: 'top' })
    }
  })

  screen.key(['S-g'], () => {
    if (store.getState().activePanel === 'messages') {
      store.dispatch({ type: 'SCROLL', payload: 'bottom' })
    }
  })

  // --- input mode ---
  screen.key(['i'], () => {
    const state = store.getState()
    if (state.activePanel !== 'input') {
      store.dispatch({ type: 'FOCUS_PANEL', payload: 'input' })
      widgets.inputBar.focus()
      widgets.inputBar.readInput(() => {})
    }
  })

  widgets.inputBar.on('submit', (value: string) => {
    const state = store.getState()
    const chat = selectedChat(state)
    const jid = selectedChatJid(state)

    if (value.trim() && chat && jid && socket) {
      socket.chat.sendMessage({ jid, text: value.trim(), chatId: chat.id })
      store.dispatch({ type: 'CLEAR_INPUT' })
    }

    widgets.inputBar.clearValue()
    store.dispatch({ type: 'FOCUS_PANEL', payload: 'chat-list' })
    screen.render()
  })

  widgets.inputBar.on('cancel', () => {
    widgets.inputBar.clearValue()
    store.dispatch({ type: 'FOCUS_PANEL', payload: 'chat-list' })
    screen.render()
  })
}
