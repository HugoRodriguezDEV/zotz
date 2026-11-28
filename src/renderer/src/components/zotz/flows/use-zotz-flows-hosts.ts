import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store/index'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import {
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId
} from '../../../../../shared/execution-host'
import type { HostComboboxOption } from '@/components/host-picker/HostCombobox'

const SEP = '\u0000'

/** This app and every paired server: the machines a flow can live and run on. */
export function useZotzFlowsHosts(): HostComboboxOption[] {
  // Primitive rows keep the selector stable for useShallow.
  const rows = useAppStore(
    useShallow((state) => {
      const out = [
        `${LOCAL_EXECUTION_HOST_ID}${SEP}${selectExecutionHostDisplayLabel(state, LOCAL_EXECUTION_HOST_ID)}`
      ]
      for (const environmentId of state.runtimeStatusByEnvironmentId.keys()) {
        if (!state.removedRuntimeEnvironmentIds.has(environmentId)) {
          const hostId = toRuntimeExecutionHostId(environmentId)
          out.push(`${hostId}${SEP}${selectExecutionHostDisplayLabel(state, hostId)}`)
        }
      }
      return out
    })
  )
  return rows.map((row) => {
    const [id, label] = row.split(SEP)
    return { id, label }
  })
}
