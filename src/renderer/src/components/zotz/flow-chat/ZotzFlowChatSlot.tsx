import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store/index'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import { structuredAgentSessionDraftScopeKey } from '@/components/native-chat/drafts/native-chat-draft-scope'
import { toRuntimeExecutionHostId } from '../../../../../shared/execution-host'
import type { NativeChatMessage } from '../../../../../shared/native-chat/native-chat-types'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { ZotzFlowInputValues } from '../../../../../shared/zotz/flows/zotz-flow-trigger-contract'
import { zotzFlowChatMachines } from './zotz-flow-chat-rpc'
import {
  closeZotzFlowChatDialog,
  openZotzFlowChatDialog,
  readZotzFlowChatEntries,
  useZotzFlowChatCatalogs,
  useZotzFlowChatDialog,
  type ZotzFlowChatMachineEntry
} from './zotz-flow-chat-store'
import {
  registerZotzFlowChatTranscript,
  runZotzFlowFromChat,
  type ZotzFlowChatOrigin
} from './zotz-flow-chat-launch'
import { ZotzFlowChatMenu, type ZotzFlowChatMenuGroup } from './ZotzFlowChatMenu'
import { ZotzFlowChatInputsDialog } from './ZotzFlowChatInputsDialog'
import { zotzFlowChatEnvironmentId } from './use-zotz-flow-chat-timed-rows'

/** A structured chat's flow plumbing: what `/flow` may read from it, and its menu and form. */
export function ZotzFlowChatSlot({
  sessionId,
  target,
  agent,
  worktreeId,
  messages
}: {
  sessionId: string
  target: RuntimeClientTarget | undefined
  agent: string
  worktreeId: string | null
  messages: readonly NativeChatMessage[]
}): React.JSX.Element | null {
  const t = useTranslate()
  useEffect(() => registerZotzFlowChatTranscript(sessionId, () => messages), [messages, sessionId])
  const dialog = useZotzFlowChatDialog(sessionId)
  const catalogs = useZotzFlowChatCatalogs()
  const environmentId = zotzFlowChatEnvironmentId(target)
  const remoteLabel = useAppStore((state) =>
    environmentId
      ? selectExecutionHostDisplayLabel(state, toRuntimeExecutionHostId(environmentId))
      : undefined
  )
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const origin: ZotzFlowChatOrigin = useMemo(
    () => ({
      sessionId,
      agent,
      worktreeId: worktreeId ?? undefined,
      draftScopeKey: structuredAgentSessionDraftScopeKey(sessionId)
    }),
    [agent, sessionId, worktreeId]
  )
  const groups = useMemo((): ZotzFlowChatMenuGroup[] => {
    const machines = zotzFlowChatMachines(environmentId)
    return machines.map((machine) => ({
      hostId: machine.hostId,
      label: machine.environmentId
        ? (remoteLabel ?? machine.hostId)
        : t('zotz.flowChat.thisMachine', 'This machine'),
      entries: readZotzFlowChatEntries([machine], catalogs)
    }))
  }, [catalogs, environmentId, remoteLabel, t])
  if (!dialog) {
    return null
  }
  const close = (): void => {
    setError(null)
    setRunning(false)
    closeZotzFlowChatDialog()
  }
  const run = (
    entry: ZotzFlowChatMachineEntry,
    text: string,
    inputs: ZotzFlowInputValues
  ): void => {
    setRunning(true)
    setError(null)
    void runZotzFlowFromChat(entry, origin, text, inputs).then((result) => {
      setRunning(false)
      if (result.ok) {
        dialog.onStarted()
        close()
      } else if (dialog.kind === 'form') {
        setError(result.error)
      } else {
        toast.error(result.error)
      }
    })
  }
  if (dialog.kind === 'menu') {
    return (
      <ZotzFlowChatMenu
        open
        groups={groups}
        loading={catalogs.size === 0}
        onClose={close}
        onChoose={(entry) => {
          if (entry.trigger.inputs.length > 0) {
            openZotzFlowChatDialog({
              kind: 'form',
              sessionId,
              entry,
              text: '',
              onStarted: dialog.onStarted
            })
          } else {
            closeZotzFlowChatDialog()
            run(entry, '', {})
          }
        }}
      />
    )
  }
  return (
    <ZotzFlowChatInputsDialog
      key={`${dialog.entry.machine.hostId}:${dialog.entry.flow.id}`}
      flowName={dialog.entry.flow.name}
      description={dialog.entry.flow.description}
      fields={dialog.entry.trigger.inputs}
      initialText={dialog.text}
      running={running}
      error={error}
      onClose={close}
      onRun={(text, inputs) => run(dialog.entry, text, inputs)}
    />
  )
}
