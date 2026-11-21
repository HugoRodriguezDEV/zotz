import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store/index'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import { installWindowVisibilityInterval } from '@/lib/window-activity/window-visibility-interval'
import {
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId,
  type ExecutionHostId
} from '../../../../../shared/execution-host'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { lastVerifiedRuntimeStatus } from '../../../../../shared/remote-runtime/host-status/runtime-host-status'
import {
  ZOTZ_CONVERSATIONS_RUNTIME_CAPABILITY,
  ZOTZ_LINKS_RUNTIME_CAPABILITY,
  type ZotzConversationEntry,
  type ZotzConversationsListResult,
  type ZotzLinkMessage,
  type ZotzLinkMessagesResult
} from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'

const REFRESH_MS = 8_000

/** A machine the links panel lists: this one first, then every connected paired server. */
export type ZotzLinkHost = {
  hostId: ExecutionHostId
  name: string
  isThisDevice: boolean
  target: RuntimeClientTarget
  /** False for a server whose Zotz predates links: it is listed, but cannot be linked. */
  supported: boolean
}

export function useZotzLinkHosts(): ZotzLinkHost[] {
  const rows = useAppStore(
    useShallow((state) => {
      const servers = (state.runtimeEnvironments ?? []).flatMap((environment) => {
        const status = lastVerifiedRuntimeStatus(
          state.runtimeStatusByEnvironmentId.get(environment.id)
        )
        if (!status) {
          return []
        }
        const hostId = toRuntimeExecutionHostId(environment.id)
        const caps = status.capabilities ?? []
        return [
          `${environment.id}\t${selectExecutionHostDisplayLabel(state, hostId)}\t${
            caps.includes(ZOTZ_CONVERSATIONS_RUNTIME_CAPABILITY) &&
            caps.includes(ZOTZ_LINKS_RUNTIME_CAPABILITY)
              ? '1'
              : '0'
          }`
        ]
      })
      return [selectExecutionHostDisplayLabel(state, LOCAL_EXECUTION_HOST_ID), ...servers]
    })
  )
  return useMemo(() => {
    const [localName, ...servers] = rows
    return [
      {
        hostId: LOCAL_EXECUTION_HOST_ID,
        name: localName,
        isThisDevice: true,
        target: { kind: 'local' },
        supported: true
      },
      ...servers.map((row): ZotzLinkHost => {
        const [environmentId, name, supported] = row.split('\t')
        return {
          hostId: toRuntimeExecutionHostId(environmentId),
          name,
          isThisDevice: false,
          target: { kind: 'environment', environmentId },
          supported: supported === '1'
        }
      })
    ]
  }, [rows])
}

export type ZotzHostConversations =
  | { status: 'loading' | 'unsupported' | 'error'; conversations: [] }
  | { status: 'ready'; conversations: ZotzConversationEntry[] }

/** Each machine's conversations, refreshed while the panel shows and the window is visible. */
export function useZotzLinkConversations(
  hosts: readonly ZotzLinkHost[],
  enabled: boolean
): ReadonlyMap<ExecutionHostId, ZotzHostConversations> {
  const [byHost, setByHost] = useState<ReadonlyMap<ExecutionHostId, ZotzHostConversations>>(
    new Map()
  )
  const key = hosts.map((h) => `${h.hostId}:${h.supported}`).join('|')
  useEffect(() => {
    if (!enabled) {
      return
    }
    let cancelled = false
    const load = (): void => {
      for (const host of hosts) {
        if (!host.supported) {
          setByHost((prev) =>
            new Map(prev).set(host.hostId, { status: 'unsupported', conversations: [] })
          )
          continue
        }
        void callRuntimeRpc<ZotzConversationsListResult>(
          host.target,
          'zotz.conversations.list',
          {},
          { timeoutMs: 10_000 }
        )
          .then((result) => {
            if (!cancelled) {
              setByHost((prev) =>
                new Map(prev).set(host.hostId, {
                  status: 'ready',
                  conversations: result.conversations
                })
              )
            }
          })
          .catch(() => {
            if (!cancelled) {
              setByHost((prev) => {
                // Keep the last good list through a blip; only a host never read shows the error.
                const current = prev.get(host.hostId)
                return current?.status === 'ready'
                  ? prev
                  : new Map(prev).set(host.hostId, { status: 'error', conversations: [] })
              })
            }
          })
      }
    }
    load()
    const stop = installWindowVisibilityInterval({ run: load, intervalMs: REFRESH_MS })
    return () => {
      cancelled = true
      stop()
    }
    // `key` stands for `hosts`: same machines and support, same requests.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])
  return byHost
}

/** Mail among a linked group, merged from every machine that holds some of it (ids are shared). */
export function useZotzLinkMessages(
  hosts: readonly ZotzLinkHost[],
  addresses: readonly string[],
  enabled: boolean
): ZotzLinkMessage[] {
  const [messages, setMessages] = useState<ZotzLinkMessage[]>([])
  const hostKey = hosts.map((h) => `${h.hostId}:${h.supported}`).join('|')
  const addressKey = addresses.join('|')
  useEffect(() => {
    if (!enabled || addresses.length < 2) {
      setMessages([])
      return
    }
    let cancelled = false
    const load = (): void => {
      const reads = hosts
        .filter((host) => host.supported)
        .map((host) =>
          callRuntimeRpc<ZotzLinkMessagesResult>(
            host.target,
            'zotz.links.messages',
            { addresses: [...addresses], limit: 200 },
            { timeoutMs: 10_000 }
          )
            .then((result) => result.messages)
            .catch(() => [] as ZotzLinkMessage[])
        )
      void Promise.all(reads).then((lists) => {
        if (cancelled) {
          return
        }
        const byId = new Map<string, ZotzLinkMessage>()
        for (const message of lists.flat()) {
          byId.set(message.id, byId.get(message.id) ?? message)
        }
        setMessages([...byId.values()].sort((a, b) => a.createdAt - b.createdAt))
      })
    }
    load()
    const stop = installWindowVisibilityInterval({ run: load, intervalMs: REFRESH_MS })
    return () => {
      cancelled = true
      stop()
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hostKey, addressKey])
  return messages
}
