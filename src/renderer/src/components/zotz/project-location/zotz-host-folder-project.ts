import { toast } from 'sonner'
import { useAppStore } from '@/store/index'
import { translate } from '@/i18n/i18n'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { extractIpcErrorMessage } from '@/runtime/errors/ipc-error'
import { browseRuntimeServerDirectory } from '@/runtime/files/reads/runtime-server-directory-browser'
import { getProjectHostSetupSelectionKey } from '@/lib/workspace/creation/project-host-setup-options'
import { upsertAddedRepoWithProjectHostSetup } from '@/components/sidebar/project-admission/completion/add-repo-store-upsert'
import { joinCreateProjectPath } from '@/components/sidebar/project-admission/create/create-project-defaults'
import { repoCreateErrorText } from '@/components/sidebar/project-admission/create/repo-create-error-copy'
import {
  getRepoExecutionHostId,
  parseExecutionHostId,
  type ExecutionHostId
} from '../../../../../shared/execution-host'
import type { Repo, RepoKind } from '../../../../../shared/repository/repo-types'
import type { RepoCreateFailure } from '../../../../../shared/repository/creation/repo-create-failure-copy'

export function getRuntimeEnvironmentIdForHost(hostId: ExecutionHostId): string | null {
  const parsed = parseExecutionHostId(hostId)
  return parsed?.kind === 'runtime' ? parsed.environmentId : null
}

function setupKeyForAddedRepo(repo: Repo): string | null {
  const hostId = getRepoExecutionHostId(repo)
  const setup = useAppStore
    .getState()
    .projectHostSetups.find((entry) => entry.repoId === repo.id && entry.hostId === hostId)
  return setup ? getProjectHostSetupSelectionKey({ id: setup.id, hostId }) : null
}

/** Adds an existing folder on the host as its own project; returns its setup selection key. */
export async function addHostFolderAsOwnProject(args: {
  hostId: ExecutionHostId
  path: string
  kind: RepoKind
}): Promise<string | null> {
  const repo = await useAppStore.getState().addRepoPath(args.path, args.kind, {
    runtimeEnvironmentId: getRuntimeEnvironmentIdForHost(args.hostId)
  })
  return repo ? setupKeyForAddedRepo(repo) : null
}

/** Where new Zotz projects live on a remote host: `<home>/zotz/projects`. */
export async function resolveHostProjectsParent(environmentId: string): Promise<string> {
  const home = await browseRuntimeServerDirectory(environmentId, '~')
  return joinCreateProjectPath(joinCreateProjectPath(home.resolvedPath, 'zotz'), 'projects')
}

export async function createHostProjectFolder(args: {
  environmentId: string
  parentPath: string
  name: string
}): Promise<{ setupKey: string | null } | { error: string }> {
  try {
    const result = await callRuntimeRpc<{ repo: Repo } | RepoCreateFailure>(
      { kind: 'environment', environmentId: args.environmentId },
      'repo.create',
      { parentPath: args.parentPath, name: args.name, kind: 'folder' },
      { timeoutMs: 60_000 }
    )
    if ('error' in result) {
      return { error: repoCreateErrorText(result) }
    }
    const { repo } = upsertAddedRepoWithProjectHostSetup(result.repo, {
      runtimeEnvironmentId: args.environmentId
    })
    toast.success(translate('zotz.hostFolder.created', 'Folder created'), {
      description: repo.path
    })
    return { setupKey: setupKeyForAddedRepo(repo) }
  } catch (error) {
    return { error: extractIpcErrorMessage(error, String(error)) }
  }
}
