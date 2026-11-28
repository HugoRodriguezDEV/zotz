import type {
  GetProjectViewTableArgs,
  ListProjectViewsArgs
} from '../../github/projects/project-request-types'
import type {
  GetProjectViewTableResult,
  ListProjectViewsResult
} from '../../github/projects/project-result-types'
import type { ZotzTaskBoardProjectSource } from './zotz-task-board-types'

/**
 * A board Project as a table, read the same way by the board (renderer) and by flows (main).
 * Roadmap views can't be read as a table, so it falls back to the project's first board or table view.
 */
export async function readZotzBoardProjectTable(
  source: Pick<ZotzTaskBoardProjectSource, 'owner' | 'ownerType' | 'number' | 'host'>,
  read: {
    table: (args: GetProjectViewTableArgs) => Promise<GetProjectViewTableResult>
    views: (args: ListProjectViewsArgs) => Promise<ListProjectViewsResult>
  }
): Promise<GetProjectViewTableResult> {
  const args = {
    owner: source.owner,
    ownerType: source.ownerType,
    projectNumber: source.number,
    ...(source.host ? { host: source.host } : {})
  }
  const first = await read.table(args)
  if (first.ok || first.error.type !== 'unsupported_layout') {
    return first
  }
  const views = await read.views(args)
  const view = views.ok ? views.views.find((item) => item.layout !== 'ROADMAP_LAYOUT') : undefined
  if (!view) {
    return first
  }
  return read.table({ ...args, viewId: view.id })
}
