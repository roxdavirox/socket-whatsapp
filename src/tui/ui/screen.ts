import blessed from 'neo-blessed'

export const createScreen = () =>
  blessed.screen({
    smartCSR: true,
    title: 'WhatsApp Agent TUI',
    fullUnicode: true,
    autoPadding: true,
  })

export type Screen = ReturnType<typeof createScreen>
