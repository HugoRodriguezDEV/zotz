import { useSyncExternalStore } from 'react'
import type { ZotzFlow } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import {
  zotzFlowChatEntries,
  type ZotzFlowChatEntry
} from '../../../../../shared/zotz/flows/zotz-flow-chat-command'
import type { ZotzFlowRun } from '../../../../../shared/zotz/flows/zotz-flow-run-contract'
import {
  subscribeZotzFlowChatMachine,
  zotzFlowChatRpc,
  type ZotzFlowChatMachine
} from './zotz-flow-chat-rpc'

export type ZotzFlowChatMachineEntry = ZotzFlowChatEntry<ZotzFlowChatMachine>

/** A run one chat fired, keyed `<hostId>:<runId>` so two machines never collide. */
export type ZotzFlowChatRunEntry = { machine: ZotzFlowChatMachine; run: ZotzFlowRun }

/** The menu or the input form, open over one chat. */
export type ZotzFlowChatDialog =
  | { kind: 'menu'; sessionId: string; onStarted: () => void }
  | {
      kind: 'form'
      sessionId: string
      entry: ZotzFlowChatMachineEntry
      text: string
      onStarted: () => void
    }

// A catalog read this recent is used as is; the menu refreshes it anyway when it opens.
const CATALOG_FRESH_MS = 15_000

type CatalogState = { flows: readonly ZotzFlow[]; readAt: number }

export type ZotzFlowChatCatalogs = ReadonlyMap<string, CatalogState>

let catalogs: ZotzFlowChatCatalogs = new Map()
let runsBySession: ReadonlyMap<string, ReadonlyMap<string, ZotzFlowChatRunEntry>> = new Map()
let dialog: ZotzFlowChatDialog | null = null
const inFlight = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Reads each machine's flows; a machine that cannot answer keeps what it last said. */
export function loadZotzFlowChatCatalog(
  machines: readonly ZotzFlowChatMachine[],
  force = false
): Promise<void> {
  return Promise.all(
    machines.map((machine) => {
      const current = catalogs.get(machine.hostId)
      if (!force && current && Date.now() - current.readAt < CATALOG_FRESH_MS) {
        return Promise.resolve()
      }
      const pending = inFlight.get(machine.hostId)
      if (pending) {
        return pending
      }
      const read = zotzFlowChatRpc
        .list(machine)
        .then(
          ({ flows }) => {
            catalogs = new Map(catalogs).set(machine.hostId, { flows, readAt: Date.now() })
            emit()
          },
          () => {}
        )
        .finally(() => inFlight.delete(machine.hostId))
      inFlight.set(machine.hostId, read)
      return read
    })
  ).then(() => {})
}

/** A flow saved or deleted on a machine shows in the chat without waiting for a reread. */
export function applyZotzFlowChatFlowEvent(
  machine: ZotzFlowChatMachine,
  event: { type: 'flow'; flow: ZotzFlow } | { type: 'flow_deleted'; flowId: string }
): void {
  const current = catalogs.get(machine.hostId)
  if (!current) {
    return
  }
  const id = event.type === 'flow' ? event.flow.id : event.flowId
  const flows = current.flows.filter((flow) => flow.id !== id)
  catalogs = new Map(catalogs).set(machine.hostId, {
    flows: event.type === 'flow' ? [...flows, event.flow] : flows,
    readAt: current.readAt
  })
  emit()
}

/** Chat-command flows of the given machines, in machine order. */
export function readZotzFlowChatEntries(
  machines: readonly ZotzFlowChatMachine[],
  from: ZotzFlowChatCatalogs = catalogs
): ZotzFlowChatMachineEntry[] {
  return machines.flatMap((machine) =>
    zotzFlowChatEntries(machine, from.get(machine.hostId)?.flows ?? [])
  )
}

export function readZotzFlowChatFlow(hostId: string, flowId: string): ZotzFlow | null {
  return catalogs.get(hostId)?.flows.find((flow) => flow.id === flowId) ?? null
}

export function useZotzFlowChatCatalogs(): ZotzFlowChatCatalogs {
  return useSyncExternalStore(subscribe, () => catalogs)
}

export function upsertZotzFlowChatRun(
  sessionId: string,
  machine: ZotzFlowChatMachine,
  run: ZotzFlowRun
): void {
  const key = `${machine.hostId}:${run.id}`
  const runs = runsBySession.get(sessionId)
  const known = runs?.get(key)
  // Stream events can arrive out of order; the newest state wins.
  if (known && (known.run.finishedAt !== null) > (run.finishedAt !== null)) {
    return
  }
  runsBySession = new Map(runsBySession).set(
    sessionId,
    new Map(runs ?? []).set(key, { machine, run })
  )
  emit()
}

const NO_RUNS: ReadonlyMap<string, ZotzFlowChatRunEntry> = new Map()

export function useZotzFlowChatRuns(sessionId: string): ReadonlyMap<string, ZotzFlowChatRunEntry> {
  return useSyncExternalStore(subscribe, () => runsBySession.get(sessionId) ?? NO_RUNS)
}

export function openZotzFlowChatDialog(next: ZotzFlowChatDialog): void {
  dialog = next
  emit()
}

export function closeZotzFlowChatDialog(): void {
  dialog = null
  emit()
}

export function useZotzFlowChatDialog(sessionId: string): ZotzFlowChatDialog | null {
  return useSyncExternalStore(subscribe, () => (dialog?.sessionId === sessionId ? dialog : null))
}

// One stream per machine however many chats show its cards.
const streams = new Map<string, { count: number; stop: () => void }>()

/** Follows a machine's flow and run changes while any chat needs them. */
export function retainZotzFlowChatMachine(machine: ZotzFlowChatMachine): () => void {
  const current = streams.get(machine.hostId)
  if (current) {
    current.count += 1
  } else {
    streams.set(machine.hostId, {
      count: 1,
      stop: subscribeZotzFlowChatMachine(machine, (event) => {
        if (event.type === 'run') {
          const sessionId = event.run.chat?.sessionId
          if (sessionId) {
            upsertZotzFlowChatRun(sessionId, machine, event.run)
          }
        } else {
          applyZotzFlowChatFlowEvent(machine, event)
        }
      })
    })
  }
  return () => {
    const stream = streams.get(machine.hostId)
    if (stream && --stream.count === 0) {
      stream.stop()
      streams.delete(machine.hostId)
    }
  }
}

/** The runs a chat fired on a machine, read once when the chat opens. */
export function loadZotzFlowChatRuns(machine: ZotzFlowChatMachine, sessionId: string): void {
  zotzFlowChatRpc.chatRuns(machine, sessionId).then(
    ({ runs }) => runs.forEach((run) => upsertZotzFlowChatRun(sessionId, machine, run)),
    // A server without flows, or an older one, has no cards to add.
    () => {}
  )
}
