import { parseExecutionHostId, type ExecutionHostId } from '../../../../../shared/execution-host'
import { isHostLocalProjectId } from '../../../../../shared/project/host-setup/project-host-setup-projection'

/** A folder or remote-less project can't be linked across machines; on another host its chosen folder becomes its own project. */
export function addsHostFolderAsOwnProject(projectId: string, hostId: ExecutionHostId): boolean {
  if (!isHostLocalProjectId(projectId)) {
    return false
  }
  const kind = parseExecutionHostId(hostId)?.kind
  // SSH hosts have no project-add path from here; they keep upstream's status-only row.
  return kind === 'local' || kind === 'runtime'
}
