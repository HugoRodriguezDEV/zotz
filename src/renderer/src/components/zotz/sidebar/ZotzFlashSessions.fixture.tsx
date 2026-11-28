import { useAppStore } from '@/store'
import { acceptedAgentStatuses } from '@/store/slices/agent-status/accepted-agent-statuses'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import type { AgentStatusEntry } from '../../../../../shared/agent-status/contracts/agent-status-types'
import type { AgentChildWorkView } from '../../../../../shared/agent-status/child-work/agent-status-child-work-view'
import type { TerminalTab } from '../../../../../shared/workspace-layout/terminal-tab-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import { EMPTY_ZOTZ_AGENT_QUEUE_SNAPSHOT } from '../../../../../shared/zotz/agent-queue/zotz-agent-queue-snapshot'
import ZotzProjectSidebar from './ZotzProjectSidebar'

const now = Date.now()
const MINUTE = 60_000
const LEAF = '11111111-1111-4111-8111-111111111111'
const REPO = 'qonda'

function worktree(branch: string, displayName: string): Worktree {
  return {
    id: `${REPO}::${branch}`,
    displayName,
    repoId: REPO,
    path: `/code/${REPO}/${branch}`,
    branch: `refs/heads/${branch}`,
    head: 'abc1234',
    isBare: false,
    isMainWorktree: false,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: now
  }
}

function child(
  id: string,
  kind: AgentChildWorkView['kind'],
  name: string,
  operation?: { toolName: string; input: string }
): AgentChildWorkView {
  return {
    id,
    providerId: `task-${id}`,
    kind,
    name,
    ...(kind === 'agent' ? { agentType: 'general-purpose' } : {}),
    state: kind === 'monitor' ? 'monitoring' : 'working',
    membership: 'live',
    ...(operation ? { operation: { ...operation, basis: 'open' as const, observedAt: now } } : {}),
    firstObservedAt: now - 12 * MINUTE,
    observedAt: now,
    stoppable: true,
    invocation: { invocationId: `spawn-${id}`, generation: 1 }
  }
}

const orchestrator = worktree('alta-trabajador', 'Feat pr94 alta trabajador')
const quiet = worktree('saludo', 'Feat saludo inicial')

function seedAgents(children: AgentChildWorkView[]): void {
  Object.assign(window.api, {
    zotzAgentQueue: {
      onChanged: () => () => {},
      snapshot: async () => EMPTY_ZOTZ_AGENT_QUEUE_SNAPSHOT
    }
  })
  const tab: TerminalTab = {
    id: 'orchestrator-tab',
    ptyId: null,
    worktreeId: orchestrator.id,
    title: 'Claude',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: now
  }
  const parent: AgentStatusEntry = {
    paneKey: `${tab.id}:${LEAF}`,
    worktreeId: orchestrator.id,
    tabId: tab.id,
    agentType: 'claude',
    state: 'working',
    prompt: 'Revisar PRs #96 y #97',
    updatedAt: now,
    stateStartedAt: now - 20 * MINUTE,
    stateHistory: [],
    children
  }
  useAppStore.setState({
    tabsByWorktree: { [orchestrator.id]: [tab] },
    agentStatusByPaneKey: acceptedAgentStatuses([[parent.paneKey, parent]])
  })
}

const store = {
  repos: [
    { id: REPO, path: `/code/${REPO}`, displayName: 'qonda-panel', badgeColor: '', addedAt: 1 }
  ],
  worktreesByRepo: { [REPO]: [orchestrator, quiet] },
  activeWorktreeId: orchestrator.id
}

const render = () => (
  <div className="flex h-[360px] flex-col bg-worktree-sidebar">
    <ZotzProjectSidebar />
  </div>
)

export const running = defineFixture({
  width: 300,
  store,
  setup: () =>
    seedAgents([
      child('a', 'agent', 'Ronda 2 PR #96', { toolName: 'Read', input: 'src/alta/form.tsx' }),
      child('b', 'agent', 'Ronda 2 PR #97', { toolName: 'Bash', input: 'pnpm test' }),
      child('c', 'monitor', 'avance del orquestador')
    ]),
  render
})

export const many = defineFixture({
  width: 300,
  store,
  setup: () =>
    seedAgents([
      child('w', 'workflow', 'review-changes'),
      child('a', 'agent', 'Ronda 2 PR #96'),
      child('b', 'agent', 'Ronda 2 PR #97'),
      child('c', 'command', 'pnpm test --maxWorkers=2'),
      child('d', 'monitor', 'avance del orquestador'),
      child('e', 'agent', 'Seguridad')
    ]),
  render
})
