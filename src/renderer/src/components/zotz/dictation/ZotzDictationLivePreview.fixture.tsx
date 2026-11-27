import { useLayoutEffect, useRef } from 'react'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzDictationLivePreview } from './ZotzDictationLivePreview'
import { setZotzDictationPreviewTarget } from './zotz-dictation-preview-target'

const LIVE = {
  dictationState: 'listening' as const,
  liveText: {
    committed: '',
    tentative:
      'quiero que el monitor muestre la memoria y el procesador en la barra de estado y que me avise a tiempo',
    speechPending: true
  }
}

function TextareaField(): React.JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
    setZotzDictationPreviewTarget({ target: { kind: 'text', element }, holding: false })
    return () => setZotzDictationPreviewTarget(null)
  }, [])
  return (
    <div className="p-4">
      <textarea
        ref={ref}
        rows={4}
        defaultValue="Revisa el tablero."
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <ZotzDictationLivePreview />
    </div>
  )
}

function EditableField(): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    element.focus()
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    setZotzDictationPreviewTarget({ target: { kind: 'contentEditable', element }, holding: false })
    return () => setZotzDictationPreviewTarget(null)
  }, [])
  return (
    <div className="p-4">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        Revisa el tablero.
      </div>
      <ZotzDictationLivePreview />
    </div>
  )
}

export const textarea = defineFixture({ width: 420, store: LIVE, render: () => <TextareaField /> })

export const editable = defineFixture({ width: 420, store: LIVE, render: () => <EditableField /> })
