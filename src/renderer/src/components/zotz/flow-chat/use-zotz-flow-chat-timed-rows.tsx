import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store/index'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import type { NativeChatTimedRow } from '@/components/native-chat/conversation/slots/native-chat-timed-rows'
import { toRuntimeExecutionHostId } from '../../../../../shared/execution-host'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { zotzFlowChatMachines, zotzFlowChatRpc } from './zotz-flow-chat-rpc'
import {
  loadZotzFlowChatCatalog,
  loadZotzFlowChatRuns,
  retainZotzFlowChatMachine,
  useZotzFlowChatCatalogs,
  useZotzFlowChatRuns
} from './zotz-flow-chat-store'
import { useZotzFlowRunOpener } from './zotz-flow-run-opener'
import { ZotzFlowChatRunCard } from './ZotzFlowChatRunCard'

export function zotzFlowChatEnvironmentId(target: RuntimeClientTarget | undefined): string | null {
  return target?.kind === 'environment' ? target.environmentId : null
}

/** Flows this chat fired, each as a card at the time it started, with live step state (spec §6.3). */
export function useZotzFlowChatTimedRows(
  chat: { sessionId: string; target?: RuntimeClientTarget } | undefined
): readonly NativeChatTimedRow[] {
  const t = useTranslate()
  const sessionId = chat?.sessionId ?? ''
  const environmentId = zotzFlowChatEnvironmentId(chat?.target)
  const enabled = chat !== undefined
  const machines = useMemo(
    () => (enabled ? zotzFlowChatMachines(environmentId) : []),
    [enabled, environmentId]
  )
  useEffect(() => {
    const releases = machines.map(retainZotzFlowChatMachine)
    machines.forEach((machine) => loadZotzFlowChatRuns(machine, sessionId))
    void loadZotzFlowChatCatalog(machines)
    return () => releases.forEach((release) => release())
  }, [machines, sessionId])
  const runs = useZotzFlowChatRuns(sessionId)
  const catalogs = useZotzFlowChatCatalogs()
  const openRun = useZotzFlowRunOpener()
  const remoteLabel = useAppStore((state) =>
    environmentId
      ? selectExecutionHostDisplayLabel(state, toRuntimeExecutionHostId(environmentId))
      : undefined
  )
  const flowRows = useMemo(
    () =>
      [...runs.values()].map(({ machine, run }): NativeChatTimedRow => ({
        key: `zotz-flow:${machine.hostId}:${run.id}`,
        at: run.createdAt,
        node: (
          <ZotzFlowChatRunCard
            flow={catalogs.get(machine.hostId)?.flows.find((f) => f.id === run.flowId) ?? null}
            run={run}
            machineLabel={machine.environmentId ? (remoteLabel ?? machine.hostId) : undefined}
            onOpenRun={
              openRun
                ? () => openRun({ hostId: machine.hostId, flowId: run.flowId, runId: run.id })
                : undefined
            }
            onCancel={() =>
              void zotzFlowChatRpc.cancel(machine, run.id).catch((error: unknown) =>
                toast.error(
                  t('zotz.flowChat.cancelFailed', 'Could not stop the flow: {{error}}', {
                    error: error instanceof Error ? error.message : String(error)
                  })
                )
              )
            }
          />
        )
      })),
    [catalogs, openRun, remoteLabel, runs, t]
  )
  return flowRows
}
