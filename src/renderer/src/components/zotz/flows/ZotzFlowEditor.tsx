import React, { useCallback, useMemo, useState } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import type { HostComboboxOption } from '@/components/host-picker/HostCombobox'
import { normalizeExecutionHostId } from '../../../../../shared/execution-host'
import type { ZotzFlow, ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowsSaveResult } from '../../../../../shared/rpc-contract/zotz/zotz-flows-params'
import { useZotzFlowEditorState } from './use-zotz-flow-editor-state'
import { useZotzFlowEditorActions } from './use-zotz-flow-editor-actions'
import { collectZotzFlowProblems, markZotzFlowProblems } from './zotz-flow-problems-view'
import { autoLayoutZotzFlow } from './zotz-flow-auto-layout'
import { removeZotzFlowElements } from './zotz-flow-graph-edits'
import { zotzFlowSlugFromName } from './zotz-flow-slug'
import { ZotzFlowCanvas } from './ZotzFlowCanvas'
import { runZotzFlowBusyAction } from './zotz-flow-busy-action'
import { ZotzFlowEditorTopBar } from './ZotzFlowEditorTopBar'
import { ZotzFlowNodePalette } from './ZotzFlowNodePalette'
import { ZotzFlowProblemsPanel } from './ZotzFlowProblemsPanel'
import { ZotzFlowNodeInspector } from './ZotzFlowNodeInspector'
import { ZotzFlowTriggerInspector } from './ZotzFlowTriggerInspector'
import type { ZotzFlowSubflowTarget } from './ZotzFlowCompositeFields'

export type ZotzFlowEditorProps = {
  initial: ZotzFlowDraft
  /** `updatedAt` of the stored flow; null while it was never saved. */
  savedAt: number | null
  hosts: readonly HostComboboxOption[]
  flows: readonly ZotzFlowSubflowTarget[]
  onSave: (draft: ZotzFlowDraft, savedAt: number | null) => Promise<ZotzFlowsSaveResult>
  onRun: (flowId: string) => Promise<void>
  onSaved?: (flow: ZotzFlow) => void
  onBack?: () => void
}

function isTextTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

const MOD =
  typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac') ? 'metaKey' : 'ctrlKey'

export function ZotzFlowEditor({
  initial,
  savedAt: initialSavedAt,
  hosts,
  flows,
  onSave,
  onRun,
  onSaved,
  onBack
}: ZotzFlowEditorProps): React.JSX.Element {
  const t = useTranslate()
  const editor = useZotzFlowEditorState(initial)
  const { draft, selection } = editor
  const actions = useZotzFlowEditorActions(editor)
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial))
  const [savedAt, setSavedAt] = useState(initialSavedAt)
  const [saving, setSaving] = useState(false)
  const [fitRequest, setFitRequest] = useState(0)
  const [running, setRunning] = useState(false)
  const [notice, setNotice] = useState<{ text: string; current?: ZotzFlow } | null>(null)
  const problems = useMemo(() => collectZotzFlowProblems(draft), [draft])
  const marks = useMemo(() => markZotzFlowProblems(problems), [problems])
  const decor = useMemo(() => ({ marks }), [marks])
  const errorCount = problems.filter((problem) => problem.severity === 'error').length
  const dirty = JSON.stringify(draft) !== baseline

  const save = useCallback(async (): Promise<boolean> => {
    setNotice(null)
    const outcome = await runZotzFlowBusyAction(setSaving, () => onSave(draft, savedAt))
    if (!outcome.ok) {
      setNotice({ text: outcome.error })
      return false
    }
    const result = outcome.value
    if (result.saved) {
      setSavedAt(result.flow.updatedAt)
      setBaseline(JSON.stringify(draft))
      onSaved?.(result.flow)
      return true
    }
    setNotice(
      result.reason === 'conflict'
        ? {
            text: t('zotz.flows.conflict', 'This flow changed somewhere else since you opened it.'),
            current: result.current
          }
        : {
            text: t(
              'zotz.flows.invalid',
              'The machine refused the flow: fix the problems listed below.'
            )
          }
    )
    return false
  }, [draft, onSave, onSaved, savedAt, t])

  const run = async (): Promise<void> => {
    if (dirty && !(await save())) {
      return
    }
    const outcome = await runZotzFlowBusyAction(setRunning, () => onRun(draft.id))
    if (!outcome.ok) {
      setNotice({ text: outcome.error })
    }
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    // Esc clears the selection so the inspector shows the triggers; open menus consume it first.
    if (event.key === 'Escape' && !event.defaultPrevented && !isTextTarget(event.target)) {
      editor.select(null)
      return
    }
    if (!event[MOD] || event.altKey) {
      return
    }
    const key = event.key.toLowerCase()
    if (key === 's') {
      event.preventDefault()
      if (errorCount === 0 && dirty && !saving) {
        void save()
      }
    } else if (!isTextTarget(event.target) && (key === 'z' || key === 'y')) {
      event.preventDefault()
      if (key === 'y' || event.shiftKey) {
        editor.redo()
      } else {
        editor.undo()
      }
    }
  }

  const selectedNode =
    selection?.kind === 'node' ? draft.nodes.find((node) => node.id === selection.id) : undefined
  const selectedEdge =
    selection?.kind === 'edge' ? draft.edges.find((edge) => edge.id === selection.id) : undefined
  const names = new Map(draft.nodes.map((node) => [node.id, node.name]))

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background" onKeyDown={onKeyDown}>
      <ZotzFlowEditorTopBar
        name={draft.name}
        onNameChange={(name) =>
          editor.edit((current) => ({
            ...current,
            name,
            // Follow the name until the slug was edited on its own.
            slug:
              current.slug === zotzFlowSlugFromName(current.name)
                ? zotzFlowSlugFromName(name)
                : current.slug
          }))
        }
        hostId={draft.hostId}
        hosts={hosts}
        hostLocked={savedAt !== null}
        onHostChange={(hostId) =>
          editor.edit((current) => ({
            ...current,
            hostId: normalizeExecutionHostId(hostId) ?? current.hostId
          }))
        }
        enabled={draft.enabled}
        onEnabledChange={(enabled) => editor.edit((current) => ({ ...current, enabled }))}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onAutoLayout={() => {
          editor.edit(autoLayoutZotzFlow)
          setFitRequest((value) => value + 1)
        }}
        errorCount={errorCount}
        dirty={dirty}
        saving={saving}
        running={running}
        onSave={() => void save()}
        onRun={() => void run()}
      />
      {notice ? (
        <div
          role="alert"
          className="flex items-center gap-3 border-b border-border bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          <span className="flex-1">{notice.text}</span>
          {notice.current ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const current = notice.current!
                editor.reset(current)
                setBaseline(JSON.stringify(current))
                setSavedAt(current.updatedAt)
                setNotice(null)
              }}
            >
              {t('zotz.flows.reload', 'Load the saved version')}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <ZotzFlowNodePalette onAdd={actions.addKind} onBack={onBack} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <ZotzFlowCanvas
              graph={draft}
              selection={selection}
              onSelect={editor.select}
              decor={decor}
              editing={actions.canvas}
              fitRequest={fitRequest}
              ariaLabel={t('zotz.flows.canvas', 'Flow canvas')}
            />
          </div>
          <ZotzFlowProblemsPanel draft={draft} problems={problems} onSelect={editor.select} />
        </div>
        <aside
          aria-label={t('zotz.flows.inspector', 'Inspector')}
          className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border bg-card scrollbar-sleek"
        >
          {selectedNode ? (
            <ZotzFlowNodeInspector
              node={selectedNode}
              draft={draft}
              problems={problems}
              flows={flows.filter((flow) => flow.id !== draft.id)}
              actions={actions.inspector}
            />
          ) : selectedEdge ? (
            <div className="flex flex-col gap-3 p-4">
              <p className="text-sm">
                <span className="font-mono">{names.get(selectedEdge.from.nodeId)}</span>
                {' → '}
                <span className="font-mono">{names.get(selectedEdge.to.nodeId)}</span>
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="self-start"
                onClick={() =>
                  editor.edit(
                    (current) => removeZotzFlowElements(current, [], [selectedEdge.id]),
                    null
                  )
                }
              >
                {t('zotz.flows.deleteConnection', 'Delete connection')}
              </Button>
            </div>
          ) : (
            <ZotzFlowTriggerInspector
              triggers={draft.triggers}
              selectedId={selection?.kind === 'triggers' ? selection.triggerId : null}
              onSelect={(triggerId) => editor.select({ kind: 'triggers', triggerId })}
              onChange={(triggers) => editor.edit((current) => ({ ...current, triggers }))}
            />
          )}
        </aside>
      </div>
    </div>
  )
}
