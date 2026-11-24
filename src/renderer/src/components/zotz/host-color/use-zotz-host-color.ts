import { useMemo } from 'react'
import { useAppStore } from '@/store/index'
import type { AppState } from '@/store/types'
import { selectWorktreeHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import { getExecutionHostIdForWorktree } from '@/lib/workspace/ownership/worktree-runtime-owner'
import { getPairedWebClientEnvironmentId } from '@/app-shell/platform/paired-web-client-host'
import { selectWslHostDistro } from '@/components/wsl-host-mark/WslHostMark'
import { selectFolderWorkspaces } from '@/store/workspaces/catalog/workspace-record-fields'
import {
  getRepoExecutionHostId,
  isUnresolvedOwnerHostId,
  parseExecutionHostId,
  type ExecutionHostId
} from '../../../../../shared/execution-host'
import { assignZotzHostColorSlots, zotzHostColorVar } from './zotz-host-color-slots'

/** Another machine: not this one, not WSL on this one, and not the server a web client is paired to. */
function isZotzColoredHost(state: AppState, hostId: ExecutionHostId): boolean {
  const parsed = parseExecutionHostId(hostId)
  if (!parsed || parsed.kind === 'local' || isUnresolvedOwnerHostId(hostId)) {
    return false
  }
  if (selectWslHostDistro(state, hostId) !== null) {
    return false
  }
  return !(
    parsed.kind === 'runtime' && parsed.environmentId === getPairedWebClientEnvironmentId(state)
  )
}

/** Every colored machine that holds a project or folder, as one string so the selector stays cheap. */
function selectColoredHostKey(state: AppState): string {
  const hostIds = new Set<ExecutionHostId>(state.repos.map(getRepoExecutionHostId))
  for (const folder of selectFolderWorkspaces(state) ?? []) {
    if (folder.executionHostId) {
      hostIds.add(folder.executionHostId)
    }
  }
  return [...hostIds]
    .filter((hostId) => isZotzColoredHost(state, hostId))
    .sort()
    .join('\n')
}

function useZotzHostColorSlots(): Map<string, number> {
  const key = useAppStore(selectColoredHostKey)
  return useMemo(() => assignZotzHostColorSlots(key ? key.split('\n') : []), [key])
}

/** Colors of the other machines that hold projects or folders; null for this machine. */
export function useZotzHostPalette(): (hostId: ExecutionHostId) => string | null {
  const slots = useZotzHostColorSlots()
  return useMemo(
    () => (hostId: ExecutionHostId) => (slots.has(hostId) ? zotzHostColorVar(slots, hostId) : null),
    [slots]
  )
}

/** A CSS color for another machine; null for this one, which is never colored. */
export function useZotzHostColor(hostId: ExecutionHostId | null | undefined): string | null {
  const slots = useZotzHostColorSlots()
  const colored = useAppStore((state) => (hostId ? isZotzColoredHost(state, hostId) : false))
  return hostId && colored ? zotzHostColorVar(slots, hostId) : null
}

export type ZotzWorktreeHost = { hostId: ExecutionHostId; label: string; color: string }

/** The other machine a workspace (and so each of its terminals) runs on; null when it runs here. */
export function useZotzWorktreeHost(
  worktreeId: string | null | undefined
): ZotzWorktreeHost | null {
  const hostId = useAppStore((state) =>
    worktreeId ? getExecutionHostIdForWorktree(state, worktreeId) : null
  )
  const color = useZotzHostColor(hostId)
  const label = useAppStore((state) =>
    worktreeId && color ? selectWorktreeHostDisplayLabel(state, worktreeId) : null
  )
  return hostId && color && label ? { hostId, label, color } : null
}
