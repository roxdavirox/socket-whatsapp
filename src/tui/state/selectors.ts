import type { AppState } from './store.js'
import type { Chat, Contact, Message } from '../types.js'

export const selectedChat = (state: AppState): Chat | null =>
  state.chats[state.selectedChatIndex] ?? null

export const currentMessages = (state: AppState): readonly Message[] => {
  const chat = selectedChat(state)
  return chat ? (state.messages.get(chat.id) ?? []) : []
}

export const contactForChat = (state: AppState, chat: Chat): Contact | null =>
  state.contacts.find(c => c.id === chat.contactId) ?? null

export const chatDisplayName = (state: AppState, chat: Chat): string => {
  const contact = contactForChat(state, chat)
  return contact?.pushName ?? contact?.name ?? contact?.jid ?? chat.contactId
}

export const selectedChatJid = (state: AppState): string | null => {
  const chat = selectedChat(state)
  if (!chat) return null
  const contact = contactForChat(state, chat)
  return contact?.jid ?? null
}
