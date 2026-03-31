export const colors = {
  bg: 'black',
  fg: 'white',
  border: 'cyan',
  borderFocus: 'green',
  accent: 'cyan',
  error: 'red',
  incoming: 'green',
  outgoing: 'cyan',
  muted: 'gray',
  selected: 'blue',
  statusBg: 'blue',
  inputBg: '#1a1a2e',
} as const

export const borderStyle = (focused: boolean) => ({
  type: 'line' as const,
  fg: focused ? colors.borderFocus : colors.border,
})

export const ICONS = {
  connected: '[*]',
  disconnected: '[ ]',
  qr: '[Q]',
  incoming: '<-',
  outgoing: '->',
  chat: '#',
  user: '@',
} as const
