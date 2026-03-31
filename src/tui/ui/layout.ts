import blessed from 'neo-blessed'
import type { Screen } from './screen.js'
import { colors } from './theme.js'

export type Widgets = {
  readonly statusBar: blessed.Widgets.BoxElement
  readonly chatList: blessed.Widgets.ListElement
  readonly messageThread: blessed.Widgets.BoxElement
  readonly inputBar: blessed.Widgets.TextboxElement
  readonly qrOverlay: blessed.Widgets.BoxElement
  readonly helpOverlay: blessed.Widgets.BoxElement
}

export const createLayout = (screen: Screen): Widgets => {
  const statusBar = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    tags: true,
    style: { fg: 'white', bg: colors.statusBg },
    content: ' WhatsApp Agent TUI',
  })

  const chatList = blessed.list({
    parent: screen,
    top: 3,
    left: 0,
    width: '30%',
    bottom: 3,
    label: ' Chats ',
    border: { type: 'line' },
    style: {
      fg: colors.fg,
      bg: colors.bg,
      border: { fg: colors.border },
      selected: { fg: 'black', bg: colors.accent },
      label: colors.accent as string,
    },
    keys: false,
    mouse: false,
    scrollable: true,
    tags: true,
  })

  const messageThread = blessed.box({
    parent: screen,
    top: 3,
    left: '30%',
    width: '70%',
    bottom: 3,
    label: ' Messages ',
    border: { type: 'line' },
    style: {
      fg: colors.fg,
      bg: colors.bg,
      border: { fg: colors.border },
      label: colors.accent as string,
    },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: '│', style: { fg: colors.muted } },
    tags: true,
  })

  const inputBar = blessed.textbox({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    label: ' Message (i to type, Enter to send, Esc to cancel) ',
    border: { type: 'line' },
    style: {
      fg: colors.fg,
      bg: colors.bg,
      border: { fg: colors.border },
      label: { fg: colors.muted },
    },
    inputOnFocus: false,
  })

  const qrOverlay = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '80%',
    height: '80%',
    label: ' Scan QR Code with WhatsApp ',
    border: { type: 'line' },
    style: {
      fg: colors.fg,
      bg: 'black',
      border: { fg: colors.accent },
      label: colors.accent as string,
    },
    tags: true,
    hidden: true,
    content: '{center}Waiting for QR code...{/center}',
  })

  const helpOverlay = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 50,
    height: 18,
    label: ' Keybindings ',
    border: { type: 'line' },
    style: {
      fg: colors.fg,
      bg: 'black',
      border: { fg: colors.accent },
      label: colors.accent as string,
    },
    tags: true,
    hidden: true,
    content: [
      '',
      ' {cyan-fg}Navigation{/cyan-fg}',
      '  Tab        Cycle panels',
      '  j / ↓      Move down',
      '  k / ↑      Move up',
      '  Enter      Select chat / Send message',
      '  g          Scroll to top',
      '  G          Scroll to bottom',
      '',
      ' {cyan-fg}Actions{/cyan-fg}',
      '  i          Start typing message',
      '  Esc        Cancel input / Close overlay',
      '  c          Connect WhatsApp session',
      '  d          Disconnect session',
      '',
      ' {cyan-fg}General{/cyan-fg}',
      '  ?          Toggle this help',
      '  q / C-c    Quit',
    ].join('\n'),
  })

  return { statusBar, chatList, messageThread, inputBar, qrOverlay, helpOverlay }
}
