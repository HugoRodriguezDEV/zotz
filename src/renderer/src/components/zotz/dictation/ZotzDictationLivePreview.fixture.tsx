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

// Same placeholder classes as NativeChatPromptEditor: a floated ::before on the empty paragraph.
function EmptyComposerField(): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    element.focus()
    setZotzDictationPreviewTarget({ target: { kind: 'contentEditable', element }, holding: false })
    return () => setZotzDictationPreviewTarget(null)
  }, [])
  return (
    <div className="p-4">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="min-h-12 rounded-md border border-input bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words [&_p]:m-0 [&_p.is-editor-empty:only-child]:before:pointer-events-none [&_p.is-editor-empty:only-child]:before:float-left [&_p.is-editor-empty:only-child]:before:h-0 [&_p.is-editor-empty:only-child]:before:text-muted-foreground [&_p.is-editor-empty:only-child]:before:content-[attr(data-placeholder)]"
      >
        <p
          className="is-editor-empty"
          data-placeholder="Ask anything, @ to mention files, / for commands"
        >
          <br />
        </p>
      </div>
      <ZotzDictationLivePreview />
    </div>
  )
}

export const textarea = defineFixture({ width: 420, store: LIVE, render: () => <TextareaField /> })

export const editable = defineFixture({ width: 420, store: LIVE, render: () => <EditableField /> })

export const emptyComposer = defineFixture({
  width: 520,
  store: LIVE,
  render: () => <EmptyComposerField />
})
