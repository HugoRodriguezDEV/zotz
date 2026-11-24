import { describe, expect, it } from 'vitest'
import { zotzProcessOwners } from './zotz-system-process-owners'

const row = (pid: number, ppid: number, name: string) => ({
  pid,
  ppid,
  name,
  command: name,
  user: 'hugo',
  cpuPercent: 0,
  memoryBytes: 0
})

describe('zotzProcessOwners', () => {
  it('tags agent trees, Zotz itself, what Zotz started, and leaves the rest alone', () => {
    const processes = [
      row(1, 0, 'launchd'),
      row(100, 1, 'Zotz'),
      row(200, 1, 'zotz-daemon'),
      row(300, 200, 'zsh'),
      row(310, 300, 'claude'),
      row(311, 310, 'node'),
      row(400, 200, 'zsh'),
      row(410, 400, 'vim'),
      row(500, 1, 'Safari')
    ]
    const owners = zotzProcessOwners(
      processes,
      [{ pid: 300, agent: 'claude', worktreeId: 'wt-1', paneKey: 'tab:1' }],
      new Set([100, 200])
    )
    expect(Object.fromEntries(owners.map((entry) => [entry.pid, entry.owner]))).toEqual({
      1: null,
      100: { kind: 'zotz' },
      200: { kind: 'zotz' },
      300: { kind: 'agent', agent: 'claude', worktreeId: 'wt-1', paneKey: 'tab:1' },
      310: { kind: 'agent', agent: 'claude', worktreeId: 'wt-1', paneKey: 'tab:1' },
      311: { kind: 'agent', agent: 'claude', worktreeId: 'wt-1', paneKey: 'tab:1' },
      400: { kind: 'zotz-child' },
      410: { kind: 'zotz-child' },
      500: null
    })
  })
})
