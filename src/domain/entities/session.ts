export type SessionStatus = 'connecting' | 'connected' | 'disconnected' | 'qr_pending'

export type Session = {
  readonly id: string
  readonly ownerId: string
  readonly status: SessionStatus
  readonly qrCode: string | null
  readonly connectedAt: Date | null
  readonly disconnectedAt: Date | null
}
