import type { GlobalSettings } from '../../global-settings-types'

/** GitHub Projects/repos plus external services feeding the task board. */
export function countZotzTaskBoardSources(
  settings: Pick<GlobalSettings, 'zotzTaskBoardSources' | 'zotzTaskConnectors'> | null | undefined
): number {
  return (settings?.zotzTaskBoardSources?.length ?? 0) + (settings?.zotzTaskConnectors?.length ?? 0)
}
