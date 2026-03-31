const padZero = (n: number) => String(n).padStart(2, '0')

export const formatTime = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${padZero(d.getHours())}:${padZero(d.getMinutes())}`
}

export const truncate = (str: string, max: number) =>
  str.length > max ? `${str.slice(0, max - 1)}~` : str

export const formatMessageLine = (
  direction: string,
  text: string | null,
  timestamp: Date | string,
) => {
  const time = formatTime(timestamp)
  const arrow = direction === 'incoming' ? '{green-fg}<-{/green-fg}' : '{cyan-fg}->{/cyan-fg}'
  const content = text ?? '[media]'
  return ` ${arrow} {gray-fg}${time}{/gray-fg} ${content}`
}

export const connectionLabel = (status: string) => {
  const labels: Record<string, string> = {
    connected: '{green-fg}[*] Connected{/green-fg}',
    connecting: '{yellow-fg}[~] Connecting{/yellow-fg}',
    qr_pending: '{yellow-fg}[Q] Scan QR{/yellow-fg}',
    disconnected: '{red-fg}[ ] Disconnected{/red-fg}',
  }
  return labels[status] ?? status
}
