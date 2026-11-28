import type { DictationInsertionTarget } from '../../dictation/dictation-insertion-target'

/** Where live dictation text is drawn: from the caret, wrapping inside the field like typed text. */
export type ZotzDictationPreviewBox = {
  /** The field's text column. */
  left: number
  width: number
  /** Top of the caret's line. */
  top: number
  /** Caret x within the text column, so the first line starts at the caret. */
  indent: number
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
  /** Whether the text before the caret needs a space before the dictated words. */
  needsSpace: boolean
}

const MIRRORED_TEXT_STYLES = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'wordSpacing',
  'tabSize'
] as const

function textColumn(element: Element): { left: number; width: number; style: CSSStyleDeclaration } {
  const rect = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  const padLeft = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.borderLeftWidth)
  const padRight = Number.parseFloat(style.paddingRight) + Number.parseFloat(style.borderRightWidth)
  return { left: rect.left + padLeft, width: Math.max(0, rect.width - padLeft - padRight), style }
}

function fontOf(style: CSSStyleDeclaration) {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing
  }
}

function endsWithText(text: string): boolean {
  return text.length > 0 && !/\s$/.test(text)
}

// The classic mirror: a hidden copy of the field up to the caret puts a marker where the caret is.
function textControlCaret(
  element: HTMLInputElement | HTMLTextAreaElement
): ZotzDictationPreviewBox {
  const column = textColumn(element)
  const caretAt = element.selectionEnd ?? element.value.length
  const mirror = document.createElement('div')
  const mirrorStyle = mirror.style
  for (const key of MIRRORED_TEXT_STYLES) {
    mirrorStyle[key] = column.style[key]
  }
  mirrorStyle.position = 'fixed'
  mirrorStyle.visibility = 'hidden'
  mirrorStyle.whiteSpace = element instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre'
  mirrorStyle.overflowWrap = 'break-word'
  mirrorStyle.top = '0'
  mirrorStyle.left = '-9999px'
  mirror.textContent = element.value.slice(0, caretAt)
  const marker = document.createElement('span')
  marker.textContent = '​'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const mirrorRect = mirror.getBoundingClientRect()
  const markerRect = marker.getBoundingClientRect()
  mirror.remove()
  const rect = element.getBoundingClientRect()
  const top = rect.top + (markerRect.top - mirrorRect.top) - element.scrollTop
  const x = rect.left + (markerRect.left - mirrorRect.left) - element.scrollLeft
  return {
    left: column.left,
    width: column.width,
    top,
    indent: Math.max(0, x - column.left),
    ...fontOf(column.style),
    needsSpace: endsWithText(element.value.slice(0, caretAt))
  }
}

function lastTextNodeBefore(range: Range): Text | null {
  const { startContainer, startOffset } = range
  if (startContainer.nodeType === Node.TEXT_NODE) {
    return null
  }
  let node: Node | null = startContainer.childNodes[startOffset - 1] ?? null
  while (node && node.nodeType !== Node.TEXT_NODE) {
    node = node.lastChild
  }
  return node instanceof Text && node.length > 0 ? node : null
}

function editableCaret(root: HTMLElement): ZotzDictationPreviewBox | null {
  const selection = root.ownerDocument.getSelection()
  const editor = root.matches('[contenteditable="true"]')
    ? root
    : root.querySelector<HTMLElement>('[contenteditable="true"]')
  const host = editor ?? root
  let range: Range | null = null
  if (selection && selection.rangeCount > 0 && host.contains(selection.anchorNode)) {
    range = selection.getRangeAt(0).cloneRange()
    range.collapse(false)
  } else {
    range = root.ownerDocument.createRange()
    range.selectNodeContents(host)
    range.collapse(false)
  }
  // A caret between elements (the end of a block) has no box; move it into the text just before it.
  const textBefore = lastTextNodeBefore(range)
  if (textBefore) {
    range.setStart(textBefore, textBefore.length)
    range.collapse(true)
  }
  let caret = range.getClientRects()[0] ?? null
  let atEnd = true
  // A collapsed range at a text node's end often has no box; the last character before it does.
  if (!caret && range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
    const previous = range.cloneRange()
    previous.setStart(range.startContainer, range.startOffset - 1)
    caret = previous.getClientRects()[0] ?? null
    atEnd = false
  }
  const column = textColumn(host)
  const caretElement =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement
  const font = fontOf(getComputedStyle(caretElement ?? host))
  const before = range.cloneRange()
  before.setStart(host, 0)
  const precedingText = before.toString()
  if (!caret) {
    const hostRect = host.getBoundingClientRect()
    return {
      left: column.left,
      width: column.width,
      top: hostRect.top + Number.parseFloat(column.style.paddingTop),
      indent: 0,
      ...font,
      needsSpace: endsWithText(precedingText)
    }
  }
  const x = atEnd ? caret.left : caret.right
  return {
    left: column.left,
    width: column.width,
    top: caret.top,
    indent: Math.max(0, x - column.left),
    ...font,
    needsSpace: endsWithText(precedingText)
  }
}

/** The terminal's own font: its WebGL renderer leaves no text in the DOM to read it from. */
export type ZotzTerminalPreviewFont = { fontFamily: string; fontSize: number; fontWeight: number }

function terminalCaret(
  pane: HTMLElement,
  font: ZotzTerminalPreviewFont
): ZotzDictationPreviewBox | null {
  // xterm keeps its input textarea on the cursor cell, sized to one cell.
  const cursor = pane.querySelector<HTMLElement>('.xterm-helper-textarea')
  const screen = pane.querySelector<HTMLElement>('.xterm-screen')
  if (!cursor || !screen) {
    return null
  }
  const cell = cursor.getBoundingClientRect()
  const area = screen.getBoundingClientRect()
  return {
    left: area.left,
    width: area.width,
    top: cell.top,
    indent: Math.max(0, cell.left - area.left),
    fontFamily: font.fontFamily,
    fontSize: `${font.fontSize}px`,
    fontWeight: String(font.fontWeight),
    lineHeight: `${cell.height}px`,
    letterSpacing: 'normal',
    needsSpace: false
  }
}

/** The field whose own placeholder would show under the preview; null where there is none. */
export function zotzDictationPreviewField(target: DictationInsertionTarget): HTMLElement | null {
  switch (target.kind) {
    case 'text':
    case 'contentEditable':
      return target.element
    case 'composer':
      return target.root
    case 'terminal':
    case 'browser':
      return null
  }
}

/** The caret box for a dictation target, or null where none can be drawn (a browser page, a gone field). */
export function readZotzDictationPreviewBox(
  target: DictationInsertionTarget,
  terminalFont: ZotzTerminalPreviewFont
): ZotzDictationPreviewBox | null {
  switch (target.kind) {
    case 'text':
      return target.element.isConnected ? textControlCaret(target.element) : null
    case 'contentEditable':
      return target.element.isConnected ? editableCaret(target.element) : null
    case 'composer': {
      if (!target.root.isConnected) {
        return null
      }
      const field = target.root.querySelector<HTMLTextAreaElement>('textarea')
      return field ? textControlCaret(field) : editableCaret(target.root)
    }
    case 'terminal':
      return target.pane.isConnected ? terminalCaret(target.pane, terminalFont) : null
    case 'browser':
      return null
  }
}
