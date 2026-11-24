import { defineFixture } from '../../../component-fixtures/component-fixture'
import type { Repo } from '../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import type { PublicKnownRuntimeEnvironment } from '../../../../../shared/remote-runtime/host-catalog/runtime-environments'
import {
  ACTIVE_TAB_INDICATOR_CLASSES,
  getTabRootStateClasses,
  getTabStripBorderClasses
} from '../../tab-bar/drop-indicator'
import { ZotzHostStrip } from './ZotzHostStrip'
import { ZotzHostTabTint } from './ZotzHostTabTint'

const msi: PublicKnownRuntimeEnvironment = {
  id: 'msi',
  name: 'MSI Server',
  source: 'manual',
  createdAt: 1,
  updatedAt: 1,
  lastUsedAt: null,
  runtimeId: null,
  preferredEndpointId: 'default',
  endpoints: []
}

function repo(id: string, executionHostId?: Repo['executionHostId']): Repo {
  return { id, path: `/code/${id}`, displayName: id, badgeColor: '', addedAt: 1, executionHostId }
}

function worktree(repoId: string): Worktree {
  return {
    id: `${repoId}::main`,
    displayName: 'main',
    repoId,
    path: `/code/${repoId}`,
    branch: 'refs/heads/main',
    head: 'abc1234',
    isBare: false,
    isMainWorktree: true,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 1
  }
}

const store = {
  repos: [repo('local-api'), repo('msi-api', 'runtime:msi')],
  runtimeEnvironments: [msi],
  worktreesByRepo: { 'local-api': [worktree('local-api')], 'msi-api': [worktree('msi-api')] }
}

/** Stand-in for a tab group: the strip with two terminal tabs, the host band and a terminal body. */
function TabGroup({ worktreeId }: { worktreeId: string }): React.JSX.Element {
  return (
    <div className="flex h-[150px] flex-col border border-border bg-background">
      <div className="flex h-[32px] shrink-0 border-b border-border bg-tab-bar">
        <ZotzHostTabTint worktreeId={worktreeId}>
          <div className="flex h-full">
            {['claude', 'zsh'].map((title, index) => (
              <div
                key={title}
                data-testid="sortable-tab"
                className={`relative flex h-full w-32 items-center px-2 text-xs ${getTabStripBorderClasses(index === 0)} ${getTabRootStateClasses(index === 0)}`}
              >
                {index === 0 ? <span className={ACTIVE_TAB_INDICATOR_CLASSES} aria-hidden /> : null}
                {title}
              </div>
            ))}
          </div>
        </ZotzHostTabTint>
      </div>
      <ZotzHostStrip worktreeId={worktreeId} />
      <div className="flex-1 p-2 font-mono text-xs text-muted-foreground">~/code/api $</div>
    </div>
  )
}

export const remoteTerminal = defineFixture({
  width: 420,
  store,
  render: () => <TabGroup worktreeId="msi-api::main" />
})

export const localTerminal = defineFixture({
  width: 420,
  store,
  render: () => <TabGroup worktreeId="local-api::main" />
})
