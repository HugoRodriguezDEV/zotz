import { homedir } from 'node:os'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { migrateLegacyOrcaWorkspaceDir } from '../../shared/zotz/zotz-home-folders'

/** Fresh profiles never had ~/orca/workspaces, so only saved profiles carry it into history. */
export function migrateSavedLegacyOrcaWorkspaceDir(
  saved: Partial<GlobalSettings>,
  hasSavedProfile: boolean,
  defaults: GlobalSettings
): Partial<GlobalSettings> {
  return hasSavedProfile ? migrateLegacyOrcaWorkspaceDir(saved, defaults, homedir()) : saved
}
