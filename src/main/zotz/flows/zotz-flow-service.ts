import { randomUUID } from 'node:crypto'
import type { ZotzFlow } from '../../../shared/zotz/flows/zotz-flow-contract'
import {
  isFinalZotzFlowRunStatus,
  type ZotzFlowChatContext,
  type ZotzFlowRun,
  type ZotzFlowRunTrigger
} from '../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowExecutorDeps } from './zotz-flow-executor-types'
import { isZotzFlowOwnEcho, type ZotzFlowRunOrigin } from './zotz-flow-origin'
import { ZotzFlowRunExecutor } from './zotz-flow-run-executor'
import type { ZotzFlowStore } from './zotz-flow-store'

const HOUR_MS = 60 * 60 * 1000

export type ZotzFlowStartOptions = {
  chat?: ZotzFlowChatContext | null
  /** Run only this step, reusing these earlier step results ("test a node"). */
  testNodeId?: string
  /** Step results carried over (retry, test) and where the retry restarts. */
  nodes?: ZotzFlowRun['nodes']
  resumedFromNodeId?: string
}

export type ZotzFlowStartResult =
  | { ok: true; run: ZotzFlowRun }
  | { ok: false; reason: 'not_found' | 'disabled' | 'loop_guard'; message: string }

type BaseDeps = Omit<ZotzFlowExecutorDeps, 'save' | 'runSubflow'>

/** Starts, paces and finishes flow runs on this machine (spec §5). */
export class ZotzFlowService {
  private readonly active = new Map<string, ZotzFlowRunExecutor>()
  private readonly waiting = new Map<string, ZotzFlowRun[]>()
  private readonly finishWaiters = new Map<string, ((run: ZotzFlowRun) => void)[]>()
  private stopped = false

  constructor(
    readonly store: ZotzFlowStore,
    private readonly baseDeps: BaseDeps,
    private readonly runSubflow: ZotzFlowExecutorDeps['runSubflow']
  ) {
    store.subscribe((event) => {
      if (event.type === 'run' && isFinalZotzFlowRunStatus(event.run.status)) {
        const waiters = this.finishWaiters.get(event.run.id) ?? []
        this.finishWaiters.delete(event.run.id)
        for (const waiter of waiters) {
          waiter(event.run)
        }
      }
    })
  }

  /**
   * The one entry point for every trigger (manual, schedule, events, chat, subflows).
   * Busy flows queue or skip by `concurrency`; past `maxRunsPerHour` the run is recorded as
   * skipped; an event the same flow caused is refused (loop guard) without recording a run.
   */
  startRun(
    flowId: string,
    trigger: ZotzFlowRunTrigger,
    origin: ZotzFlowRunOrigin,
    options: ZotzFlowStartOptions = {}
  ): ZotzFlowStartResult {
    const flow = this.store.getFlow(flowId)
    if (!flow) {
      return { ok: false, reason: 'not_found', message: 'This flow does not exist.' }
    }
    if (!flow.enabled && origin.source !== 'manual' && origin.source !== 'flow') {
      return { ok: false, reason: 'disabled', message: 'This flow is turned off.' }
    }
    if (isZotzFlowOwnEcho(flowId, origin)) {
      return { ok: false, reason: 'loop_guard', message: 'The flow caused this event itself.' }
    }
    const now = this.baseDeps.now()
    const run: ZotzFlowRun = {
      id: randomUUID(),
      flowId,
      flowUpdatedAt: flow.updatedAt,
      runNumber: this.store.nextRunNumber(flowId),
      hostId: flow.hostId,
      status: 'queued',
      trigger,
      chat: options.chat ?? null,
      nodes: options.nodes ?? [],
      ...(options.resumedFromNodeId ? { resumedFromNodeId: options.resumedFromNodeId } : {}),
      ...(options.testNodeId ? { testNodeId: options.testNodeId } : {}),
      ...(origin.source === 'flow' ? { parent: origin.parent } : {}),
      error: null,
      createdAt: now,
      queuedAt: now,
      startedAt: null,
      finishedAt: null
    }
    const lastHour = this.store
      .listAllRuns()
      .filter((entry) => entry.flowId === flowId && entry.createdAt > now - HOUR_MS)
      .filter((entry) => entry.status !== 'skipped').length
    if (lastHour >= flow.maxRunsPerHour) {
      return {
        ok: true,
        run: this.skip(
          run,
          `This flow already ran ${flow.maxRunsPerHour} times in the last hour.`,
          'hourly_cap'
        )
      }
    }
    if (this.runningCount(flowId) >= flow.concurrency.max) {
      if (flow.concurrency.whenBusy === 'skip') {
        return { ok: true, run: this.skip(run, 'The flow was busy with another run.', 'busy') }
      }
      this.store.putRun(run)
      this.waiting.set(flowId, [...(this.waiting.get(flowId) ?? []), run])
      return { ok: true, run: structuredClone(run) }
    }
    this.launch(flow, run, false)
    return { ok: true, run: structuredClone(run) }
  }

  /** Picks up the runs a restart interrupted: steps reattach or fail as interrupted (spec §5). */
  resumeAll(): void {
    const unfinished = this.store
      .listAllRuns()
      .filter((run) => !isFinalZotzFlowRunStatus(run.status))
      .sort((a, b) => a.createdAt - b.createdAt)
    for (const stored of unfinished) {
      const run = structuredClone(stored)
      const flow = this.store.getFlow(run.flowId)
      if (!flow) {
        this.skip(run, 'The flow was deleted.', 'flow_deleted', 'failed')
      } else if (run.status === 'queued') {
        this.waiting.set(flow.id, [...(this.waiting.get(flow.id) ?? []), run])
      } else {
        this.launch(flow, run, true)
      }
    }
    for (const flowId of this.waiting.keys()) {
      this.drain(flowId)
    }
  }

  cancel(runId: string): ZotzFlowRun | null {
    const executor = this.active.get(runId)
    if (executor) {
      executor.cancel()
      return structuredClone(executor.run)
    }
    const run = this.store.getRun(runId)
    if (run && !isFinalZotzFlowRunStatus(run.status)) {
      this.waiting.set(
        run.flowId,
        (this.waiting.get(run.flowId) ?? []).filter((entry) => entry.id !== runId)
      )
      return this.skip(structuredClone(run), 'Cancelled.', 'cancelled', 'cancelled')
    }
    return run
  }

  approve(
    runId: string,
    nodeId: string,
    iteration: number[],
    decision: 'approved' | 'rejected',
    note: string | null
  ): boolean {
    return this.active.get(runId)?.approve(nodeId, iteration, decision, null, note) ?? false
  }

  /** Resolves once the run is final; rejects only when the signal aborts. */
  awaitFinal(runId: string, signal?: AbortSignal): Promise<ZotzFlowRun> {
    const current = this.store.getRun(runId)
    if (!current || isFinalZotzFlowRunStatus(current.status)) {
      return current ? Promise.resolve(current) : Promise.reject(new Error('Run not found.'))
    }
    return new Promise((resolve, reject) => {
      const done = (run: ZotzFlowRun): void => {
        signal?.removeEventListener('abort', abort)
        resolve(run)
      }
      const abort = (): void => {
        this.finishWaiters.set(
          runId,
          (this.finishWaiters.get(runId) ?? []).filter((w) => w !== done)
        )
        reject(signal?.reason)
      }
      this.finishWaiters.set(runId, [...(this.finishWaiters.get(runId) ?? []), done])
      signal?.addEventListener('abort', abort, { once: true })
    })
  }

  stop(): void {
    this.stopped = true
  }

  private runningCount(flowId: string): number {
    return [...this.active.values()].filter((executor) => executor.flow.id === flowId).length
  }

  private skip(
    run: ZotzFlowRun,
    error: string,
    errorCode: string,
    status: 'skipped' | 'failed' | 'cancelled' = 'skipped'
  ): ZotzFlowRun {
    run.status = status
    run.error = error
    run.errorCode = errorCode
    run.finishedAt = this.baseDeps.now()
    this.store.putRun(run)
    return structuredClone(run)
  }

  private launch(flow: ZotzFlow, run: ZotzFlowRun, resuming: boolean): void {
    const executor = new ZotzFlowRunExecutor(
      flow,
      run,
      {
        ...this.baseDeps,
        save: (next) => {
          if (!this.stopped) {
            this.store.putRun(next)
          }
        },
        runSubflow: this.runSubflow
      },
      { resuming }
    )
    this.active.set(run.id, executor)
    void executor
      .execute()
      .catch((error: unknown) => console.error('[zotz-flows] run failed to finish:', error))
      .finally(() => {
        this.active.delete(run.id)
        this.drain(flow.id)
      })
  }

  private drain(flowId: string): void {
    const flow = this.store.getFlow(flowId)
    const queue = this.waiting.get(flowId) ?? []
    while (
      flow &&
      !this.stopped &&
      queue.length > 0 &&
      this.runningCount(flowId) < flow.concurrency.max
    ) {
      this.launch(flow, queue.shift()!, false)
    }
    if (queue.length === 0) {
      this.waiting.delete(flowId)
    }
  }
}
