import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@/store'
import { pluginFontFamilyWhenLoaded } from '@/store/plugins/appearance/plugin-fonts'
import { buildFontFamily } from '../../../../../shared/monospace-font-family'
import { appendDictationText } from '../../../../../shared/speech/dictation/dictation-transcript-spacing'
import {
  readZotzDictationPreviewBox,
  zotzDictationPreviewField,
  type ZotzDictationPreviewBox
} from './zotz-dictation-preview-geometry'
import { useZotzDictationPreviewTarget } from './zotz-dictation-preview-target'

const DICTATING_ATTRIBUTE = 'data-zotz-dictating'
// Tiptap's placeholder is a ::before on the empty paragraph; text fields use ::placeholder.
const HIDE_FIELD_PLACEHOLDER_CSS = `[${DICTATING_ATTRIBUTE}] p.is-editor-empty::before,[${DICTATING_ATTRIBUTE}][data-placeholder]::before{visibility:hidden}[${DICTATING_ATTRIBUTE}]::placeholder,[${DICTATING_ATTRIBUTE}] textarea::placeholder{color:transparent}`

/**
 * Draws the words being dictated at the caret of the field they will land in, wrapping like typed
 * text, until they are inserted for real. Nothing is written into the field before then, so undo and
 * typing alongside keep working.
 */
export function ZotzDictationLivePreview(): React.JSX.Element | null {
  const current = useZotzDictationPreviewTarget((s) => s.current)
  const liveText = useAppStore((s) => s.liveText)
  const dictating = useAppStore(
    (s) => s.dictationState === 'listening' || s.dictationState === 'stopping'
  )
  const tentative = liveText.tentative.trim()
  const text = current?.holding ? appendDictationText(liveText.committed, tentative) : tentative
  const visible = dictating && current !== null && text !== ''
  const terminalFontFamily = useAppStore((s) => s.settings?.terminalFontFamily)
  const terminalFontSize = useAppStore((s) => s.settings?.terminalFontSize ?? 13)
  const terminalFontWeight = useAppStore((s) => s.settings?.terminalFontWeight ?? 400)
  const [box, setBox] = useState<ZotzDictationPreviewBox | null>(null)

  useLayoutEffect(() => {
    if (!visible || !current) {
      setBox(null)
      return
    }
    const terminalFont = {
      fontFamily: buildFontFamily(pluginFontFamilyWhenLoaded(terminalFontFamily ?? '')),
      fontSize: terminalFontSize,
      fontWeight: terminalFontWeight
    }
    const measure = (): void => setBox(readZotzDictationPreviewBox(current.target, terminalFont))
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [visible, current, text, terminalFontFamily, terminalFontSize, terminalFontWeight])

  // An empty field's placeholder sits where the preview is drawn; hide it (keeping its layout) meanwhile.
  useLayoutEffect(() => {
    const field = visible && current ? zotzDictationPreviewField(current.target) : null
    field?.setAttribute(DICTATING_ATTRIBUTE, '')
    return () => field?.removeAttribute(DICTATING_ATTRIBUTE)
  }, [visible, current])

  if (!visible || !box) {
    return null
  }
  return createPortal(
    <>
      <style>{HIDE_FIELD_PLACEHOLDER_CSS}</style>
      <div
        aria-hidden
        data-zotz-dictation-preview=""
        className="pointer-events-none fixed z-50 whitespace-pre-wrap break-words text-muted-foreground"
        style={{
          left: box.left,
          top: box.top,
          width: box.width,
          textIndent: box.indent,
          fontFamily: box.fontFamily,
          fontSize: box.fontSize,
          fontWeight: box.fontWeight,
          lineHeight: box.lineHeight,
          letterSpacing: box.letterSpacing
        }}
      >
        {box.needsSpace ? ` ${text}` : text}
      </div>
    </>,
    document.body
  )
}
