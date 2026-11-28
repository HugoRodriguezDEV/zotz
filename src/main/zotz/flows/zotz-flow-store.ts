import { join } from 'node:path'
import { readJsonFile, SerialJsonWriter } from '../zotz-json-file'
import {
  ZotzFlowSchema,
  type ZotzFlow,
  type ZotzFlowDraft
} from '../../../shared/zotz/flows/zotz-flow-contract'
import type {
  ZotzFlowRun,
  ZotzFlowRunsPage
} from '../../../shared/zotz/flows/zotz-flow-run-contract'
import {
  nextZotzFlowRunNumber,
  pruneZotzFlowRuns
} from '../../../shared/zotz/flows/zotz-flow-run-retention'
import { validateZotzFlow } from '../../../shared/zotz/flows/zotz-flow-validation'
import {
  hasZotzFlowErrors,
  zotzFlowError,
  type ZotzFlowProblem
} from '../../../shared/zotz/flows/zotz-flow-problems'
import type {
  ZotzFlowsSaveResult,
  ZotzFlowsStreamEvent
} from '../../../shared/rpc-contract/zotz/zotz-flows-params'

const FLOWS_FILE = 'zotz-flows.json'
const RUNS_FILE = 'zotz-flow-runs.json'
// Runs change on every node step; batch those writes instead of rewriting the file per step.
const RUN_WRITE_DELAY_MS = 400
const DEFAULT_RUNS_PAGE = 50

/** Next due time of each schedule trigger, kept with the runs so a restart can catch up (spec §4.2). */
export type ZotzFlowScheduleState = Record<string, { nextRunAt: number; signature: string }>

type RunsFile = { version: 1; runs: ZotzFlowRun[]; schedules: ZotzFlowScheduleState }

function isRunRecord(value: unknown): value is ZotzFlowRun {
  if (!value || typeof value !== 'object') {
    return false
  }
  const run = value as Partial<ZotzFlowRun>
  return (
    typeof run.id === 'string' &&
    typeof run.flowId === 'string' &&
    typeof run.status === 'string' &&
    Array.isArray(run.nodes) &&
    typeof run.createdAt === 'number'
  )
}

/** Flows and their runs on the machine that runs them (spec §7). */
export class ZotzFlowStore {
  private flows = new Map<string, ZotzFlow>()
  private runs = new Map<string, ZotzFlowRun>()
  private schedules: ZotzFlowScheduleState = {}
  private readonly flowsWriter = new SerialJsonWriter()
  private readonly runsWriter = new SerialJsonWriter()
  private runsTimer: ReturnType<typeof setTimeout> | null = null
  private readonly listeners = new Set<(event: ZotzFlowsStreamEvent) => void>()

  constructor(
    private readonly userDataPath: string,
    private readonly now: () => number = Date.now
  ) {}

  async load(): Promise<void> {
    const flowsFile = (await readJsonFile(join(this.userDataPath, FLOWS_FILE))) as
      | { flows?: unknown[] }
      | undefined
    for (const entry of flowsFile?.flows ?? []) {
      const parsed = ZotzFlowSchema.safeParse(entry)
      if (parsed.success) {
        this.flows.set(parsed.data.id, parsed.data)
      } else {
        console.warn('[zotz-flows] skipped an unreadable flow:', parsed.error.issues[0]?.message)
      }
    }
    const runsFile = (await readJsonFile(join(this.userDataPath, RUNS_FILE))) as
      | Partial<RunsFile>
      | undefined
    for (const run of (runsFile?.runs ?? []).filter(isRunRecord)) {
      this.runs.set(run.id, run)
    }
    this.schedules =
      runsFile?.schedules && typeof runsFile.schedules === 'object' ? runsFile.schedules : {}
  }

  subscribe(listener: (event: ZotzFlowsStreamEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: ZotzFlowsStreamEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        console.warn('[zotz-flows] a listener failed:', error)
      }
    }
  }

  listFlows(): ZotzFlow[] {
    return [...this.flows.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  getFlow(id: string): ZotzFlow | null {
    return this.flows.get(id) ?? null
  }

  getFlowBySlug(slug: string): ZotzFlow | null {
    return [...this.flows.values()].find((flow) => flow.slug === slug) ?? null
  }

  saveFlow(draft: ZotzFlowDraft, expectedUpdatedAt: number | null): ZotzFlowsSaveResult {
    const current = this.flows.get(draft.id) ?? null
    if (current && current.updatedAt !== expectedUpdatedAt) {
      return { saved: false, reason: 'conflict', current }
    }
    const problems: ZotzFlowProblem[] = validateZotzFlow(draft)
    const sameSlug = [...this.flows.values()].find(
      (flow) => flow.slug === draft.slug && flow.id !== draft.id
    )
    if (sameSlug) {
      problems.push(
        zotzFlowError('duplicate_slug', `Another flow already uses "${draft.slug}".`, {
          params: { slug: draft.slug, flow: sameSlug.name }
        })
      )
    }
    if (hasZotzFlowErrors(problems)) {
      return { saved: false, reason: 'invalid', problems }
    }
    const now = this.now()
    const flow: ZotzFlow = {
      ...draft,
      createdAt: current?.createdAt ?? now,
      // Strictly newer, so a save in the same millisecond still invalidates the editor's copy.
      updatedAt: Math.max(now, (current?.updatedAt ?? 0) + 1)
    }
    this.flows.set(flow.id, flow)
    this.writeFlows()
    this.emit({ type: 'flow', flow })
    return { saved: true, flow, problems }
  }

  deleteFlow(id: string): boolean {
    if (!this.flows.delete(id)) {
      return false
    }
    for (const run of this.runs.values()) {
      if (run.flowId === id) {
        this.runs.delete(run.id)
      }
    }
    for (const key of Object.keys(this.schedules)) {
      if (key.startsWith(`${id}:`)) {
        delete this.schedules[key]
      }
    }
    this.writeFlows()
    this.scheduleRunsWrite()
    this.emit({ type: 'flow_deleted', flowId: id })
    return true
  }

  getRun(id: string): ZotzFlowRun | null {
    return this.runs.get(id) ?? null
  }

  listAllRuns(): ZotzFlowRun[] {
    return [...this.runs.values()]
  }

  /** Newest first; the cursor is the id of the last run of the previous page. */
  listRuns(flowId: string, limit = DEFAULT_RUNS_PAGE, cursor?: string): ZotzFlowRunsPage {
    const runs = [...this.runs.values()]
      .filter((run) => run.flowId === flowId)
      .sort((a, b) => b.createdAt - a.createdAt || b.runNumber - a.runNumber)
    const start = cursor ? runs.findIndex((run) => run.id === cursor) + 1 : 0
    const page = runs.slice(start, start + limit)
    const more = start + limit < runs.length
    return { runs: page, nextCursor: more ? (page.at(-1)?.id ?? null) : null }
  }

  nextRunNumber(flowId: string): number {
    return nextZotzFlowRunNumber([...this.runs.values()].filter((run) => run.flowId === flowId))
  }

  /** Stores a run snapshot and tells subscribers; the caller keeps mutating its own copy. */
  putRun(run: ZotzFlowRun): void {
    const snapshot = structuredClone(run)
    this.runs.set(run.id, snapshot)
    this.scheduleRunsWrite()
    this.emit({ type: 'run', run: snapshot })
  }

  getSchedules(): ZotzFlowScheduleState {
    return this.schedules
  }

  setSchedules(next: ZotzFlowScheduleState): void {
    this.schedules = next
    this.scheduleRunsWrite()
  }

  /** Writes pending run changes now, e.g. before the app quits. */
  async flush(): Promise<void> {
    if (this.runsTimer) {
      clearTimeout(this.runsTimer)
      this.runsTimer = null
    }
    await this.writeRuns()
  }

  private writeFlows(): void {
    void this.flowsWriter
      .write(join(this.userDataPath, FLOWS_FILE), { version: 1, flows: this.listFlows() })
      .catch((error) => console.error('[zotz-flows] could not save flows:', error))
  }

  private scheduleRunsWrite(): void {
    if (this.runsTimer) {
      return
    }
    this.runsTimer = setTimeout(() => {
      this.runsTimer = null
      void this.writeRuns()
    }, RUN_WRITE_DELAY_MS)
    this.runsTimer.unref?.()
  }

  private async writeRuns(): Promise<void> {
    const kept = pruneZotzFlowRuns([...this.runs.values()])
    if (kept.length !== this.runs.size) {
      this.runs = new Map(kept.map((run) => [run.id, run]))
    }
    const file: RunsFile = { version: 1, runs: kept, schedules: this.schedules }
    await this.runsWriter
      .write(join(this.userDataPath, RUNS_FILE), file)
      .catch((error) => console.error('[zotz-flows] could not save flow runs:', error))
  }
}
