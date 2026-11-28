import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Automation } from '../../../shared/automations/automation-definition'
import {
  ZotzAutomationMigration,
  type ZotzAutomationSource
} from './zotz-flow-automation-migration'
import { ZotzFlowStore } from './zotz-flow-store'

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function automation(overrides: Partial<Automation> = {}): Automation {
  return {
    id: 'auto-1',
    name: 'Revisar dependencias',
    prompt: 'Revisa las dependencias y abre un PR si hay que subir algo.',
    precheck: { command: 'test -f package.json', timeoutSeconds: 30 },
    agentId: 'claude',
    surface: 'terminal',
    runContext: {
      kind: 'workspace-run',
      projectId: 'project-1',
      hostId: 'local',
      projectHostSetupId: 'setup-1',
      repoId: 'repo-1',
      path: '/repos/app'
    },
    projectId: 'repo-1',
    executionTargetType: 'local',
    executionTargetId: 'local',
    schedulerOwner: 'local_host_service',
    workspaceMode: 'new_per_run',
    workspaceId: null,
    baseBranch: 'main',
    reuseSession: false,
    timezone: 'America/Mexico_City',
    rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
    dtstart: 1_700_000_000_000,
    enabled: true,
    nextRunAt: 1_800_000_000_000,
    missedRunPolicy: 'run_once_within_grace',
    missedRunGraceMinutes: 720,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

function source(rows: Automation[]): ZotzAutomationSource & { disabled: string[] } {
  const disabled: string[] = []
  return {
    disabled,
    list: () => rows.map((row) => (disabled.includes(row.id) ? { ...row, enabled: false } : row)),
    prepare: (row) => ({ automation: row, precheckCwd: '/repos/app' }),
    disable: (id) => {
      disabled.push(id)
    }
  }
}

async function migrate(dir: string, automations: ZotzAutomationSource, warned: string[] = []) {
  const flowStore = new ZotzFlowStore(dir)
  await flowStore.load()
  const migration = new ZotzAutomationMigration({
    automations,
    flowStore,
    userDataPath: dir,
    serveMode: false,
    warn: (row) => warned.push(row.id)
  })
  await migration.load()
  migration.migrateAll()
  await migration.flushed()
  await flowStore.flush()
  return flowStore
}

describe('ZotzAutomationMigration', () => {
  it('turns an automation with a precheck into command, condition and agent, and turns it off', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'zotz-flow-migration-'))
    dirs.push(dir)
    const automations = source([automation()])

    const flowStore = await migrate(dir, automations)

    const [flow] = flowStore.listFlows()
    expect(flow).toMatchObject({
      name: 'Revisar dependencias',
      slug: 'revisar-dependencias',
      hostId: 'local',
      enabled: true,
      migratedFromAutomationId: 'auto-1',
      triggers: [
        {
          kind: 'schedule',
          rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
          timezone: 'America/Mexico_City',
          dtstart: 1_700_000_000_000
        }
      ]
    })
    expect(flow.nodes.map((node) => [node.name, node.kind])).toEqual([
      ['chequeo', 'command'],
      ['paso_chequeo', 'condition'],
      ['agente', 'agent']
    ])
    expect(flow.nodes[0]).toMatchObject({
      command: 'test -f package.json',
      timeoutSeconds: 30,
      cwd: '/repos/app'
    })
    expect(flow.nodes[1]).toMatchObject({
      value: '{{chequeo.exitCode}}',
      operator: 'exit_code_zero'
    })
    expect(flow.nodes[2]).toMatchObject({
      agentId: 'claude',
      surface: 'terminal',
      prompt: 'Revisa las dependencias y abre un PR si hay que subir algo.',
      workspaceSource: 'new_per_run',
      baseBranch: 'main',
      runContext: { repoId: 'repo-1', hostId: 'local' }
    })
    expect(flow.edges.map((edge) => [edge.from.port, edge.to.nodeId])).toEqual([
      ['main', flow.nodes[1].id],
      ['true', flow.nodes[2].id]
    ])
    expect(automations.disabled).toEqual(['auto-1'])
    // The flow's schedule continues from the automation's own next run.
    expect(Object.values(flowStore.getSchedules())).toEqual([
      expect.objectContaining({ nextRunAt: 1_800_000_000_000 })
    ])
  })

  it('migrates each automation once, even after its flow was deleted', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'zotz-flow-migration-'))
    dirs.push(dir)
    const automations = source([automation({ precheck: null })])
    const first = await migrate(dir, automations)
    expect(first.listFlows()).toHaveLength(1)

    expect((await migrate(dir, automations)).listFlows()).toHaveLength(1)
    const again = await migrate(dir, automations)
    again.deleteFlow(again.listFlows()[0].id)
    await again.flush()
    expect((await migrate(dir, automations)).listFlows()).toHaveLength(0)
  })

  it('leaves SSH automations running as automations and warns once', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'zotz-flow-migration-'))
    dirs.push(dir)
    const automations = source([
      automation({
        executionTargetType: 'ssh',
        executionTargetId: 'box',
        schedulerOwner: 'ssh_bridge'
      }),
      automation({ id: 'mirror', schedulerOwner: 'remote_host_service' })
    ])
    const warned: string[] = []

    expect((await migrate(dir, automations, warned)).listFlows()).toHaveLength(0)
    await migrate(dir, automations, warned)

    expect(automations.disabled).toEqual([])
    expect(warned).toEqual(['auto-1'])
  })
})
