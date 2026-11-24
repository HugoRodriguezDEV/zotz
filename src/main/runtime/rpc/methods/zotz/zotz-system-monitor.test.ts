import { describe, expect, it, vi } from 'vitest'
import type { ZotzSystemMonitorUpdate } from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import { registerZotzSystemMonitorSource } from '../../../../zotz/system-monitor/zotz-system-monitor-source'
import { ZOTZ_SYSTEM_MONITOR_SUBSCRIBE_METHOD as subscribeMethod } from './zotz-system-monitor'

function rpcContext(signal: AbortSignal): never {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler reads only runtime.registerSubscriptionCleanup, signal and connectionId, so a partial context is enough.
  return {
    runtime: { registerSubscriptionCleanup: vi.fn() },
    signal,
    connectionId: 'socket-1'
  } as never
}

describe('zotz.systemMonitor.subscribe', () => {
  it('samples while a paired client watches and stops when it leaves', async () => {
    const watch = vi
      .fn()
      .mockReturnValue({ history: [], latest: null, historyMs: 1, intervalMs: 1 })
    const unwatch = vi.fn()
    let push: (update: ZotzSystemMonitorUpdate) => void = () => {}
    const unregister = registerZotzSystemMonitorSource({
      service: {
        watch,
        unwatch,
        onUpdate: (listener) => {
          push = listener
          return () => {
            push = () => {}
          }
        },
        processList: () => ({ sampledAt: null, processes: [] })
      },
      processCommand: async () => null,
      closeProcess: async () => ({ ok: true, exited: true })
    })
    const emitted: unknown[] = []
    const leave = new AbortController()

    const stream = subscribeMethod.handler({}, rpcContext(leave.signal), (frame) =>
      emitted.push(frame)
    )
    await Promise.resolve()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stream forwards the update object untouched, so a marker is enough.
    push({ sample: null, latest: 'reading' } as never)
    leave.abort()
    await stream

    expect(emitted).toEqual([
      { type: 'snapshot', snapshot: { history: [], latest: null, historyMs: 1, intervalMs: 1 } },
      { type: 'update', update: { sample: null, latest: 'reading' } }
    ])
    const watcherId = watch.mock.calls[0][0]
    expect(unwatch).toHaveBeenCalledWith(watcherId)
    // Window watchers are webContents ids; a remote one must never collide with them.
    expect(watcherId).toBeGreaterThan(1_000_000_000)
    unregister()
  })
})
