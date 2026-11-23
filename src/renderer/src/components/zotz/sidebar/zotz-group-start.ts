import { toast } from 'sonner'
import { useAppStore } from '@/store/index'
import { translate } from '@/i18n/i18n'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { launchAgentInNewTabWithOutcome } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { settleAgentTabLaunch } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab-host-agents'
import { planAgentSessionLaunch } from '@/lib/agent-session/launch/routing/agent-session-launch-plan'
import { createNonSecureContextUuid } from '../../../../../shared/identifiers/non-secure-context-uuid'
import {
  LOCAL_EXECUTION_HOST_ID,
  getRepoExecutionHostId
} from '../../../../../shared/execution-host'
import { isRepoHidden } from '../../../../../shared/hidden-projects'
import { getProjectIdentityKey } from '../../../../../shared/project/host-setup/project-host-setup-projection'
import { slugifyForWorkspaceName } from '../../../../../shared/workspace/naming/workspace-name'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'
import type { Repo } from '../../../../../shared/repository/repo-types'
import { moveZotzConversationToGroup, type ZotzLinkContext } from '../links/zotz-link-actions'

export type ZotzGroupStart = {
  task: string
  agent: TuiAgent
  repos: readonly Repo[]
}

/** One repo per sidebar project (this machine's copy first), for starting a group's conversations. */
export function zotzStartableProjects(repos: readonly Repo[]): Repo[] {
  const byProject = new Map<string, Repo>()
  for (const repo of repos) {
    if (isRepoHidden(repo) || (repo.kind && repo.kind !== 'git')) {
      continue
    }
    const key = getProjectIdentityKey(repo)
    const kept = byProject.get(key)
    if (
      !kept ||
      (getRepoExecutionHostId(kept) !== LOCAL_EXECUTION_HOST_ID &&
        getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID)
    ) {
      byProject.set(key, repo)
    }
  }
  return [...byProject.values()]
}

async function createIn(repo: Repo, groupName: string): Promise<{ id: string; path: string }> {
  const created = await useAppStore.getState().createWorktree(
    repo.id,
    slugifyForWorkspaceName(groupName) || 'group',
    undefined,
    'inherit',
    undefined,
    'sidebar',
    groupName,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    // A project several machines publish refuses a create without a host.
    { executionHostId: getRepoExecutionHostId(repo) }
  )
  return { id: created.worktree.id, path: created.worktree.path }
}

async function launchIn(worktreeId: string, start: ZotzGroupStart): Promise<boolean> {
  const result = launchAgentInNewTabWithOutcome({
    agent: start.agent,
    worktreeId,
    prompt: start.task,
    promptDelivery: 'submit-after-ready',
    agentSessionLaunchPlan: planAgentSessionLaunch(useAppStore.getState(), {
      requestId: createNonSecureContextUuid(),
      agent: start.agent,
      workspace: { kind: 'git-worktree', worktreeId },
      prompt: start.task,
      promptDelivery: 'submit-after-ready'
    }),
    // The agent opens the first surface; revealing must not seed a sibling shell.
    beforeSurfaceOpen: () =>
      activateAndRevealWorktree(worktreeId, {
        sidebarRevealBehavior: 'auto',
        providesInitialSurface: true
      }) !== false
  })
  const settled = await settleAgentTabLaunch(result)
  return settled.kind === 'terminal' || settled.kind === 'structured'
}

/**
 * Starts a group in one go: a conversation per chosen project, all in the group (so their agents
 * learn about each other as they start), then the same task sent to each agent.
 */
export async function startZotzGroupConversations(
  groupId: string,
  groupName: string,
  start: ZotzGroupStart,
  context: ZotzLinkContext
): Promise<void> {
  const created: { repo: Repo; id: string; path: string }[] = []
  for (const repo of start.repos) {
    try {
      created.push({ repo, ...(await createIn(repo, groupName)) })
    } catch (error) {
      toast.error(
        translate(
          'zotz.groups.startCreateFailed',
          'Could not start a conversation in {{project}}',
          {
            project: repo.displayName
          }
        ),
        { description: error instanceof Error ? error.message : String(error) }
      )
    }
  }
  const [first, ...rest] = created.map(({ repo, path }) => ({
    hostId: getRepoExecutionHostId(repo),
    path
  }))
  if (!first) {
    return
  }
  await moveZotzConversationToGroup(first, groupId, context, undefined, rest)
  for (const { repo, id } of created) {
    if (!(await launchIn(id, start))) {
      toast.error(
        translate('zotz.groups.startLaunchFailed', "The agent in {{project}} didn't start", {
          project: repo.displayName
        })
      )
    }
  }
}
