import { normalizeRuntimePathForComparison } from '../cross-platform-path'
import type { OrcaWorkspaceLayout } from '../orca-workspace-layout'

/** Visible folder in the user's home (`~/zotz/workspaces`, `~/zotz/projects`); `~/.orca` stays (RENAME-SPEC). */
export const ZOTZ_HOME_FOLDER_NAME = 'zotz'
// Builds before this change created worktrees under ~/orca/workspaces.
export const LEGACY_ORCA_HOME_FOLDER_NAME = 'orca'

export function joinHomeFolder(homeDir: string, ...segments: string[]): string {
  const separator = homeDir.includes('\\') ? '\\' : '/'
  const trimmedHomeDir = homeDir.replace(/[\\/]+$/, '')
  return [trimmedHomeDir, ...segments].join(separator)
}

export function getLegacyOrcaWorkspaceDir(homeDir: string): string {
  return joinHomeFolder(homeDir, LEGACY_ORCA_HOME_FOLDER_NAME, 'workspaces')
}

type WorkspaceDirSettings = {
  workspaceDir?: string
  nestWorkspaces?: boolean
  workspaceDirHistory?: OrcaWorkspaceLayout[]
}

/**
 * Moves a profile still on the old `~/orca/workspaces` default to the Zotz default. The old root
 * goes to history so worktrees already created there keep their ownership and visibility.
 */
export function migrateLegacyOrcaWorkspaceDir<T extends WorkspaceDirSettings>(
  saved: T,
  defaults: { workspaceDir: string; nestWorkspaces: boolean },
  homeDir: string
): T {
  const legacyDir = getLegacyOrcaWorkspaceDir(homeDir)
  const savedDir = saved.workspaceDir
  if (
    savedDir !== undefined &&
    normalizeRuntimePathForComparison(savedDir) !== normalizeRuntimePathForComparison(legacyDir)
  ) {
    return saved
  }
  const legacyLayout = {
    path: legacyDir,
    nestWorkspaces: saved.nestWorkspaces ?? defaults.nestWorkspaces
  }
  const history = saved.workspaceDirHistory ?? []
  const hasLegacyLayout = history.some(
    (layout) =>
      normalizeRuntimePathForComparison(layout.path) ===
        normalizeRuntimePathForComparison(legacyLayout.path) &&
      layout.nestWorkspaces === legacyLayout.nestWorkspaces
  )
  return {
    ...saved,
    workspaceDir: defaults.workspaceDir,
    workspaceDirHistory: hasLegacyLayout ? history : [...history, legacyLayout]
  }
}
