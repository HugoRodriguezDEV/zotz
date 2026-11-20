import { useMemo } from 'react'
import { useNow } from '@/hooks/use-now'
import { activateTabAndFocusPane } from '@/lib/workspace/tabs/activate-tab-and-focus-pane'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { useAppStore } from '@/store/index'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { getIndexedAllWorktrees } from '@/store/slices/worktrees/listing/worktree-catalog-index'
import { parsePaneKey } from '../../../../../shared/workspace-layout/stable-pane-id'
import { navigateResourceSessionToTab } from '../../status-bar/resources/session-actions/resource-session-navigation'
import { ZotzAgentQueueBoard } from './ZotzAgentQueueBoard'
import { useZotzAgentQueue } from './zotz-agent-queue-store'

/** The live agent queue board, wired to the queue actions and pane navigation. */
export function ZotzAgentQueuePanel({
  active,
  onNavigate
}: {
  active: boolean
  onNavigate: () => void
}): React.JSX.Element {
  const snapshot = useZotzAgentQueue()
  const now = useNow(30_000, active)
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const tabsByWorktree = useAppStore((s) => s.tabsByWorktree)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const names = useMemo(
    () =>
      new Map(
        getIndexedAllWorktrees(worktreesByRepo).map((worktree) => [
          worktree.id,
          worktree.displayName
        ])
      ),
    [worktreesByRepo]
  )

  return (
    <ZotzAgentQueueBoard
      snapshot={snapshot}
      now={now}
      workspaceName={(worktreeId) => (worktreeId ? (names.get(worktreeId) ?? worktreeId) : '')}
      onForceStart={(id) => void window.api.zotzAgentQueue.forceStart(id)}
      onCancel={(id) => void window.api.zotzAgentQueue.cancel(id)}
      onOpenPane={(paneKey) => {
        const tabId = parsePaneKey(paneKey)?.tabId
        if (!tabId) {
          return
        }
        onNavigate()
        navigateResourceSessionToTab(tabId, paneKey, {
          tabsByWorktree,
          setActiveView,
          activateAndRevealWorktree,
          activateTabAndFocusPane
        })
      }}
    />
  )
}
