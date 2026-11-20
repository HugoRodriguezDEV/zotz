import { useEffect, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store/index'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import {
  LOCAL_EXECUTION_HOST_ID,
  parseRoutableExecutionHostId,
  type ExecutionHostId
} from '../../../../../shared/execution-host'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { lastVerifiedRuntimeStatus } from '../../../../../shared/remote-runtime/host-status/runtime-host-status'
import { ZOTZ_SHORT_NAMES_RUNTIME_CAPABILITY } from '../../../../../shared/zotz/agent-queue/zotz-agent-queue-runtime-capability'
import type { ZotzShortNameSetResult } from '../../../../../shared/zotz/zotz-short-name'

type CustomNames = Readonly<Record<string, string>>

// Custom short names each host keeps, by host; a host missing here shows folder names.
let namesByHost: ReadonlyMap<ExecutionHostId, CustomNames> = new Map()
const loading = new Set<ExecutionHostId>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setHostNames(hostId: ExecutionHostId, names: CustomNames): void {
  namesByHost = new Map(namesByHost).set(hostId, names)
  listeners.forEach((listener) => listener())
}

/** This app or a paired server; SSH rows have no Zotz of their own to keep names. */
function shortNameTarget(
  state: ReturnType<typeof useAppStore.getState>,
  hostId: ExecutionHostId
): RuntimeClientTarget | null {
  if (hostId === LOCAL_EXECUTION_HOST_ID) {
    return { kind: 'local' }
  }
  const parsed = parseRoutableExecutionHostId(hostId)
  if (parsed?.kind !== 'runtime') {
    return null
  }
  const status = lastVerifiedRuntimeStatus(
    state.runtimeStatusByEnvironmentId.get(parsed.environmentId)
  )
  return status?.capabilities?.includes(ZOTZ_SHORT_NAMES_RUNTIME_CAPABILITY)
    ? { kind: 'environment', environmentId: parsed.environmentId }
    : null
}

async function loadHostNames(hostId: ExecutionHostId, target: RuntimeClientTarget): Promise<void> {
  if (loading.has(hostId) || namesByHost.has(hostId)) {
    return
  }
  loading.add(hostId)
  try {
    const { names } = await callRuntimeRpc<{ names: Record<string, string> }>(
      target,
      'zotz.shortNames.list',
      {},
      { timeoutMs: 10_000 }
    )
    setHostNames(hostId, names)
  } catch {
    // Unreachable for now: folder names stand in, and the next reconnect retries.
  } finally {
    loading.delete(hostId)
  }
}

/** Custom short names of the given hosts, fetched once each host can answer. */
export function useZotzCustomShortNames(
  hostIds: readonly ExecutionHostId[]
): ReadonlyMap<ExecutionHostId, CustomNames> {
  const names = useSyncExternalStore(subscribe, () => namesByHost)
  const reachable = useAppStore((state) =>
    hostIds.filter((hostId) => shortNameTarget(state, hostId) !== null).join('\n')
  )
  useEffect(() => {
    const state = useAppStore.getState()
    for (const hostId of reachable ? (reachable.split('\n') as ExecutionHostId[]) : []) {
      const target = shortNameTarget(state, hostId)
      if (target) {
        void loadHostNames(hostId, target)
      }
    }
  }, [reachable])
  return names
}

export function canEditZotzShortName(hostId: ExecutionHostId): boolean {
  return shortNameTarget(useAppStore.getState(), hostId) !== null
}

/** Saves on the host that owns the workspace; an empty name goes back to the folder name. */
export async function saveZotzShortName(
  hostId: ExecutionHostId,
  path: string,
  shortName: string
): Promise<ZotzShortNameSetResult> {
  const target = shortNameTarget(useAppStore.getState(), hostId)
  if (!target) {
    throw new Error('This machine cannot keep short names yet.')
  }
  const result = await callRuntimeRpc<ZotzShortNameSetResult>(
    target,
    'zotz.shortNames.set',
    { path, shortName },
    { timeoutMs: 10_000 }
  )
  setHostNames(hostId, result.names)
  return result
}
