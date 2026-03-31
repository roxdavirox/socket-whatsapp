import type { Chat, Contact, Message } from '../types.js'

export type ActivePanel = 'chat-list' | 'messages' | 'input'

export type AppState = {
  readonly auth: { token: string; user: { id: string; email: string; name: string; role: string } } | null
  readonly connection: 'disconnected' | 'connecting' | 'qr_pending' | 'connected'
  readonly qrCode: string | null
  readonly chats: readonly Chat[]
  readonly contacts: readonly Contact[]
  readonly messages: ReadonlyMap<string, readonly Message[]>
  readonly selectedChatIndex: number
  readonly activePanel: ActivePanel
  readonly inputText: string
  readonly error: string | null
  readonly scrollOffset: number
}

export type Action =
  | { type: 'AUTH_SUCCESS'; payload: NonNullable<AppState['auth']> }
  | { type: 'CHATS_LOADED'; payload: readonly Chat[] }
  | { type: 'CONTACTS_LOADED'; payload: readonly Contact[] }
  | { type: 'MESSAGES_LOADED'; payload: { chatId: string; messages: readonly Message[] } }
  | { type: 'MESSAGE_RECEIVED'; payload: { chatId: string; message: Message } }
  | { type: 'SELECT_CHAT'; payload: number }
  | { type: 'NAVIGATE_CHAT'; payload: 'up' | 'down' }
  | { type: 'CYCLE_PANEL' }
  | { type: 'FOCUS_PANEL'; payload: ActivePanel }
  | { type: 'SET_INPUT'; payload: string }
  | { type: 'CLEAR_INPUT' }
  | { type: 'QR_RECEIVED'; payload: string }
  | { type: 'CONNECTION_CHANGED'; payload: AppState['connection'] }
  | { type: 'SCROLL'; payload: 'up' | 'down' | 'top' | 'bottom' }
  | { type: 'ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }

const PANELS: readonly ActivePanel[] = ['chat-list', 'messages', 'input']

const nextPanel = (current: ActivePanel): ActivePanel =>
  PANELS[(PANELS.indexOf(current) + 1) % PANELS.length] ?? 'chat-list'

const clampIndex = (index: number, length: number) =>
  Math.max(0, Math.min(index, length - 1))

export const initialState: AppState = {
  auth: null,
  connection: 'disconnected',
  qrCode: null,
  chats: [],
  contacts: [],
  messages: new Map(),
  selectedChatIndex: 0,
  activePanel: 'chat-list',
  inputText: '',
  error: null,
  scrollOffset: 0,
}

export const reduce = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'AUTH_SUCCESS':
      return { ...state, auth: action.payload }
    case 'CHATS_LOADED':
      return { ...state, chats: action.payload }
    case 'CONTACTS_LOADED':
      return { ...state, contacts: action.payload }
    case 'MESSAGES_LOADED': {
      const msgs = new Map(state.messages)
      msgs.set(action.payload.chatId, action.payload.messages)
      return { ...state, messages: msgs, scrollOffset: 0 }
    }
    case 'MESSAGE_RECEIVED': {
      const { chatId, message } = action.payload
      const existing = state.messages.get(chatId) ?? []
      const msgs = new Map(state.messages)
      msgs.set(chatId, [...existing, message])
      return { ...state, messages: msgs }
    }
    case 'SELECT_CHAT':
      return { ...state, selectedChatIndex: clampIndex(action.payload, state.chats.length), scrollOffset: 0 }
    case 'NAVIGATE_CHAT': {
      const delta = action.payload === 'up' ? -1 : 1
      return { ...state, selectedChatIndex: clampIndex(state.selectedChatIndex + delta, state.chats.length), scrollOffset: 0 }
    }
    case 'CYCLE_PANEL':
      return { ...state, activePanel: nextPanel(state.activePanel) }
    case 'FOCUS_PANEL':
      return { ...state, activePanel: action.payload }
    case 'SET_INPUT':
      return { ...state, inputText: action.payload }
    case 'CLEAR_INPUT':
      return { ...state, inputText: '' }
    case 'QR_RECEIVED':
      return { ...state, qrCode: action.payload, connection: 'qr_pending' }
    case 'CONNECTION_CHANGED':
      return { ...state, connection: action.payload, qrCode: action.payload === 'connected' ? null : state.qrCode }
    case 'SCROLL': {
      const dir = action.payload
      if (dir === 'top') return { ...state, scrollOffset: 0 }
      if (dir === 'bottom') return { ...state, scrollOffset: -1 }
      const delta = dir === 'up' ? -1 : 1
      return { ...state, scrollOffset: Math.max(0, state.scrollOffset + delta) }
    }
    case 'ERROR':
      return { ...state, error: action.payload }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
  }
}

export type Store = {
  readonly getState: () => AppState
  readonly dispatch: (action: Action) => void
  readonly subscribe: (listener: (state: AppState) => void) => () => void
}

export const createStore = (initial: AppState = initialState): Store => {
  const state = { current: initial }
  const listeners = new Set<(state: AppState) => void>()

  return {
    getState: () => state.current,
    dispatch: (action) => {
      state.current = reduce(state.current, action)
      listeners.forEach(fn => fn(state.current))
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
