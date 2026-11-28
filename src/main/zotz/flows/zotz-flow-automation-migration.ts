import { join } from 'node:path'
import { z } from 'zod'
import type { Automation } from '../../../shared/automations/automation-definition'
import { LOCAL_EXECUTION_HOST_ID, parseExecutionHostId } from '../../../shared/execution-host'
import type { ZotzFlow } from '../../../shared/zotz/flows/zotz-flow-contract'
import { uniqueZotzFlowSlug } from '../../../shared/zotz/flows/zotz-flow-slug'
import {
  captureLegacyRunTarget,
  resolveAutomationRunTarget
} from '../../automations/ownership/run-target-resolution'
import type { Store } from '../../persistence/loading-store/store'
import type { ZotzFlowsMigrationSkipReason } from '../../../shared/rpc-contract/zotz/zotz-flows-params'
import { readJsonFile, SerialJsonWriter } from '../zotz-json-file'
import { buildZotzFlowFromAutomation } from './zotz-flow-from-automation'
import { zotzFlowScheduleSignature } from './zotz-flow-scheduler'
import type { ZotzFlowStore } from './zotz-flow-store'

const LEDGER_FILE = 'zotz-flow-migrations.json'

export type ZotzAutomationMigrationOutcome =
  | { status: 'migrated'; automationId: string; flow: ZotzFlow }
  | { status: 'already'; automationId: string; flow: ZotzFlow | null }
  | {
      status: 'skipped'
      automationId: string
      reason: ZotzFlowsMigrationSkipReason
      message: string
    }

const LedgerSchema = z
  .object({
    migrated: z.array(z.string()).catch([]),
    warned: z.array(z.string()).catch([])
  })
  .catch({ migrated: [], warned: [] })

/**
 * Which machine migrates an automation: the one whose scheduler runs it (spec §7, §8). A desktop
 * holds mirrors of its servers' automations; those servers migrate them.
 */
function classify(
  automation: Automation,
  serveMode: boolean
): { here: true } | { here: false; reason: ZotzFlowsMigrationSkipReason; message: string } {
  const host = parseExecutionHostId(automation.runContext?.hostId)
  if (
    automation.executionTargetType === 'ssh' ||
    automation.schedulerOwner === 'ssh_bridge' ||
    host?.kind === 'ssh'
  ) {
    // A flow runs its steps on the machine that stores it; SSH hosts run no Zotz of their own.
    return {
      here: false,
      reason: 'ssh',
      message: 'It runs over SSH, and flows only run on a Zotz machine.'
    }
  }
  if (automation.schedulerOwner === 'remote_host_service' || host?.kind === 'runtime') {
    return serveMode && automation.schedulerOwner === 'remote_host_service'
      ? { here: true }
      : { here: false, reason: 'elsewhere', message: 'Its server migrates it.' }
  }
  if (automation.createdBy?.kind === 'plugin' && automation.createdBy.endedAt === undefined) {
    return {
      here: false,
      reason: 'plugin',
      message: `The plugin "${automation.createdBy.name}" manages it.`
    }
  }
  return { here: true }
}

/** The automations of this machine, as the migration reads and changes them. */
export type ZotzAutomationSource = {
  list(): Automation[]
  /** Stamps a legacy row's run context and finds the folder its precheck runs in. */
  prepare(automation: Automation): { automation: Automation; precheckCwd: string | null }
  disable(automationId: string): void
}

export function zotzAutomationSourceFromStore(
  store: Store,
  serveMode: boolean
): ZotzAutomationSource {
  return {
    list: () => store.listAutomations(),
    prepare: (listed) => {
      // Legacy rows get the run context the scheduler would stamp on their next run.
      const automation = captureLegacyRunTarget(store, listed, serveMode)
      const target = resolveAutomationRunTarget(store, automation, {
        allowRemoteHostScheduling: serveMode
      })
      return { automation, precheckCwd: target.ok ? target.cwd : null }
    },
    disable: (automationId) => {
      store.disableAutomations(new Set([automationId]))
    }
  }
}

/** Turns this machine's automations into flows once each; the originals stay, turned off. */
export class ZotzAutomationMigration {
  private migrated = new Set<string>()
  private warned = new Set<string>()
  private readonly writer = new SerialJsonWriter()
  private written: Promise<void> = Promise.resolve()

  constructor(
    private readonly input: {
      automations: ZotzAutomationSource
      flowStore: ZotzFlowStore
      userDataPath: string
      serveMode: boolean
      /** One notice per automation left behind, so the person knows why it is still an automation. */
      warn: (automation: Automation, message: string) => void
    }
  ) {}

  async load(): Promise<void> {
    const ledger = LedgerSchema.parse(
      await readJsonFile(join(this.input.userDataPath, LEDGER_FILE))
    )
    this.migrated = new Set(ledger.migrated)
    this.warned = new Set(ledger.warned)
  }

  migrateAll(): ZotzAutomationMigrationOutcome[] {
    const outcomes = this.input.automations.list().map((automation) => this.migrate(automation.id))
    for (const outcome of outcomes) {
      if (outcome.status !== 'skipped' || outcome.reason === 'elsewhere') {
        continue
      }
      console.warn(
        `[zotz-flows] automation ${outcome.automationId} stays an automation: ${outcome.message}`
      )
      const automation = this.input.automations
        .list()
        .find((entry) => entry.id === outcome.automationId)
      if (automation && !this.warned.has(automation.id)) {
        this.warned.add(automation.id)
        this.input.warn(automation, outcome.message)
      }
    }
    this.persist()
    return outcomes
  }

  migrate(automationId: string): ZotzAutomationMigrationOutcome {
    const { automations, flowStore } = this.input
    const listed = automations.list().find((entry) => entry.id === automationId)
    const existing =
      flowStore.listFlows().find((flow) => flow.migratedFromAutomationId === automationId) ?? null
    if (this.migrated.has(automationId) || existing) {
      if (!this.migrated.has(automationId) && listed) {
        // The flow was saved but Zotz stopped before the original was turned off.
        this.finish(listed)
      }
      return { status: 'already', automationId, flow: existing }
    }
    if (!listed) {
      return { status: 'skipped', automationId, reason: 'invalid', message: 'Not found.' }
    }
    const place = classify(listed, this.input.serveMode)
    if (!place.here) {
      return { status: 'skipped', automationId, ...place }
    }
    let prepared: ReturnType<ZotzAutomationSource['prepare']>
    try {
      prepared = automations.prepare(listed)
    } catch (error) {
      return { status: 'skipped', automationId, reason: 'invalid', message: String(error) }
    }
    const { automation, precheckCwd } = prepared
    const runtimeHost = parseExecutionHostId(automation.runContext?.hostId)
    const built = buildZotzFlowFromAutomation(automation, {
      hostId: runtimeHost?.kind === 'runtime' ? runtimeHost.id : LOCAL_EXECUTION_HOST_ID,
      slug: uniqueZotzFlowSlug(
        automation.name,
        flowStore.listFlows().map((flow) => flow.slug)
      ),
      ...(precheckCwd ? { precheckCwd } : {})
    })
    if (!built.ok) {
      return { status: 'skipped', automationId, reason: 'invalid', message: built.message }
    }
    const saved = flowStore.saveFlow(built.draft, null)
    if (!saved.saved) {
      const message =
        saved.reason === 'invalid'
          ? saved.problems.map((problem) => problem.message).join(' ')
          : 'A flow with the same id already exists.'
      return { status: 'skipped', automationId, reason: 'invalid', message }
    }
    if (automation.enabled && Number.isFinite(automation.nextRunAt)) {
      const trigger = built.draft.triggers.find((entry) => entry.id === built.scheduleTriggerId)
      if (trigger?.kind === 'schedule') {
        // Continues the automation's own next occurrence, so a run due during the switch still happens.
        flowStore.setSchedules({
          ...flowStore.getSchedules(),
          [`${saved.flow.id}:${trigger.id}`]: {
            nextRunAt: automation.nextRunAt,
            signature: zotzFlowScheduleSignature(trigger)
          }
        })
      }
    }
    this.finish(automation)
    return { status: 'migrated', automationId, flow: saved.flow }
  }

  private finish(automation: Automation): void {
    this.migrated.add(automation.id)
    this.input.automations.disable(automation.id)
    this.persist()
  }

  /** Resolves once the ledger reached disk. */
  flushed(): Promise<void> {
    return this.written
  }

  private persist(): void {
    this.written = this.writer
      .write(join(this.input.userDataPath, LEDGER_FILE), {
        version: 1,
        migrated: [...this.migrated],
        warned: [...this.warned]
      })
      .catch((error) => console.error('[zotz-flows] could not save the migration ledger:', error))
  }
}
