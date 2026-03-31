type HistoryEntry = { readonly direction: string; readonly text: string | null }

const senderLabel = (direction: string) =>
  direction === 'incoming' ? 'User' : 'Bot'

export const formatMessage = (m: HistoryEntry) =>
  `${senderLabel(m.direction)}: ${m.text ?? '[media]'}`

export const formatHistory = (history: readonly HistoryEntry[]) =>
  history.slice(-10).map(formatMessage).join('\n')

export const formatFullHistory = (history: readonly HistoryEntry[]) =>
  history.map(formatMessage).join('\n')
