import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store/index'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import {
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId
} from '../../../../../shared/execution-host'
import { lastVerifiedRuntimeStatus } from '../../../../../shared/remote-runtime/host-status/runtime-host-status'
import {
  ZOTZ_SYSTEM_MONITOR_CONTROL_RUNTIME_CAPABILITY,
  ZOTZ_SYSTEM_MONITOR_RUNTIME_CAPABILITY
} from '../../../../../shared/zotz/agent-queue/zotz-agent-queue-runtime-capability'

export type ZotzSystemMachine = {
  /** 'local' or the server's environment id. */
  key: string
  name: string
  environmentId: string | null
  canClose: boolean
}

const SEP = '\u0000'

/** This machine, then every paired server that samples itself; older servers are left out. */
export function useZotzSystemMachines(): ZotzSystemMachine[] {
  // Primitive rows keep the selector stable for useShallow; objects are rebuilt below.
  const rows = useAppStore(
    useShallow((state) => {
      const out: string[] = []
      for (const [environmentId, entry] of state.runtimeStatusByEnvironmentId) {
        const capabilities = lastVerifiedRuntimeStatus(entry)?.capabilities ?? []
        if (
          state.removedRuntimeEnvironmentIds.has(environmentId) ||
          !capabilities.includes(ZOTZ_SYSTEM_MONITOR_RUNTIME_CAPABILITY)
        ) {
          continue
        }
        out.push(
          [
            environmentId,
            selectExecutionHostDisplayLabel(state, toRuntimeExecutionHostId(environmentId)),
            capabilities.includes(ZOTZ_SYSTEM_MONITOR_CONTROL_RUNTIME_CAPABILITY) ? '1' : '0'
          ].join(SEP)
        )
      }
      return out
    })
  )
  const localName = useAppStore((state) =>
    selectExecutionHostDisplayLabel(state, LOCAL_EXECUTION_HOST_ID)
  )
  return [
    { key: LOCAL_EXECUTION_HOST_ID, name: localName, environmentId: null, canClose: true },
    ...rows.map((row): ZotzSystemMachine => {
      const [environmentId, name, canClose] = row.split(SEP)
      return { key: environmentId, name, environmentId, canClose: canClose === '1' }
    })
  ]
}
