import { describe, expect, it } from 'vitest'
import { migrateLegacyOrcaWorkspaceDir } from './zotz-home-folders'

const defaults = { workspaceDir: '/Users/hugo/zotz/workspaces', nestWorkspaces: true }

describe('migrateLegacyOrcaWorkspaceDir', () => {
  it('moves the old default to ~/zotz/workspaces and keeps ~/orca/workspaces in history', () => {
    expect(
      migrateLegacyOrcaWorkspaceDir(
        { workspaceDir: '/Users/hugo/orca/workspaces', nestWorkspaces: true },
        defaults,
        '/Users/hugo'
      )
    ).toEqual({
      workspaceDir: '/Users/hugo/zotz/workspaces',
      nestWorkspaces: true,
      workspaceDirHistory: [{ path: '/Users/hugo/orca/workspaces', nestWorkspaces: true }]
    })
  })

  it('treats a saved profile without workspaceDir as the old default', () => {
    expect(migrateLegacyOrcaWorkspaceDir({}, defaults, 'C:\\Users\\hugo')).toEqual({
      workspaceDir: '/Users/hugo/zotz/workspaces',
      workspaceDirHistory: [{ path: 'C:\\Users\\hugo\\orca\\workspaces', nestWorkspaces: true }]
    })
  })

  it('keeps a folder the user chose', () => {
    const saved = { workspaceDir: '/Volumes/dev/worktrees', nestWorkspaces: false }
    expect(migrateLegacyOrcaWorkspaceDir(saved, defaults, '/Users/hugo')).toBe(saved)
  })
})
