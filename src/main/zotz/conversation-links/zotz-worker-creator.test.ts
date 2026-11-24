import { describe, expect, it, vi } from 'vitest'
import type { WorktreeMeta } from '../../../shared/worktree/meta-types'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { OrchestrationDb } from '../../runtime/orchestration/db/orchestration-db'
import {
  createWorkerWorktree,
  resolveWorkerWorktreeCreationTarget
} from '../../runtime/rpc/methods/orchestration/worker/start/placement/worker-worktree-creation'

function fakeRuntime(existing: Partial<WorktreeMeta> = {}) {
  const written: Partial<WorktreeMeta>[] = []
  const runtime = {
    showRepo: vi.fn().mockResolvedValue({ id: 'backend', kind: 'git' }),
    showManagedWorktree: vi.fn().mockResolvedValue({ id: 'panel::/w/orq', repoId: 'panel' }),
    createManagedWorktree: vi.fn().mockResolvedValue({
      worktree: { id: 'backend::/w/api', repoId: 'backend', hostId: 'local' },
      startupTerminal: { handle: 'term_worker' }
    }),
    listTerminals: vi.fn().mockResolvedValue({ terminals: [] }),
    requireStore: () => ({
      getWorktreeMeta: () => existing,
      getWorktreeMetaForHost: () => existing,
      setWorktreeMeta: (_target: unknown, meta: Partial<WorktreeMeta>) => {
        written.push(meta)
        return { ...existing, ...meta }
      }
    }),
    invalidateResolvedWorktreeCache: vi.fn(),
    notifyWorktreesChanged: vi.fn()
  }
  return { runtime, written }
}

async function startTopLevelWorker(runtime: ReturnType<typeof fakeRuntime>['runtime']) {
  const target = await resolveWorkerWorktreeCreationTarget({
    runtime,
    requestedWorktree: 'new-top-level',
    repo: 'id:backend',
    callerWorktreeId: 'panel::/w/orq'
  })
  await createWorkerWorktree({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake implements every runtime method this create path calls
    runtime: runtime as unknown as OrcaRuntimeService,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: recordWorkerStage is the only db method this create path calls
    db: { recordWorkerStage: vi.fn() } as unknown as OrchestrationDb,
    dispatchId: 'dispatch_1',
    requestedWorktree: 'new-top-level',
    target,
    params: { from: 'term_orq', name: 'api', displayName: 'api' },
    agent: 'claude',
    withAgentTerminal: true,
    effects: []
  })
}

describe('worker-start records the conversation that created it', () => {
  it('nests a top-level worker in another repo under its dispatcher', async () => {
    const { runtime, written } = fakeRuntime({ displayNameIsPinned: true })

    await startTopLevelWorker(runtime)

    expect(written).toEqual([
      {
        cliProvenance: expect.objectContaining({
          kind: 'created-by-cli',
          startupAgent: 'claude',
          zotzParentWorktreeId: 'panel::/w/orq'
        }),
        displayNameIsPinned: true
      }
    ])
    expect(runtime.notifyWorktreesChanged).toHaveBeenCalledWith('backend')
  })

  it('keeps an automatic name automatic', async () => {
    const { runtime, written } = fakeRuntime({})

    await startTopLevelWorker(runtime)

    expect(written[0]?.displayNameIsPinned).toBe(false)
  })
})
