import { ipcMain } from 'electron'
import type { GitHubRepositoryIdentity as GitHubOwnerRepo } from '../../../shared/github/repositories/repository-identity'
import { ZOTZ_PR_REVIEW_EVENTS, type ZotzPrReviewEvent } from '../../../shared/zotz/zotz-pr-review'
import { markPRDraft } from '../../github/client/update/pr-ready'
import type { Store } from '../../persistence/loading-store/store'
import {
  assertRegisteredGitHubRepo,
  getGitHubLocalGitOptionArgs,
  getGitHubRepoConnectionId,
  type GitHubRepoScopedArgs
} from '../../ipc/source-control/github-repo-routing'
import { broadcastGitHubWorkItemMutation } from '../../ipc/source-control/github-work-item-mutation-events'
import { submitPRReview } from './zotz-pr-review'

type PrArgs = GitHubRepoScopedArgs & { prNumber: number; prRepo?: GitHubOwnerRepo | null }

function isPrNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/** Desktop IPC for the PR actions upstream only exposes over runtime RPC (draft) or not at all (review). */
export function registerZotzPrReviewHandlers(store: Store): void {
  ipcMain.handle('gh:markPRDraft', async (event, args: PrArgs) => {
    const repo = assertRegisteredGitHubRepo(args, store)
    if (!isPrNumber(args.prNumber)) {
      return { ok: false, error: 'Invalid pull request number' }
    }
    const result = await markPRDraft(
      repo.path,
      args.prNumber,
      getGitHubRepoConnectionId(repo),
      args.prRepo ?? null,
      ...getGitHubLocalGitOptionArgs(store, repo)
    )
    if (result.ok) {
      broadcastGitHubWorkItemMutation(
        { repoPath: repo.path, repoId: repo.id, type: 'pr', number: args.prNumber },
        event.sender.id
      )
    }
    return result
  })

  ipcMain.handle(
    'gh:submitPRReview',
    async (event, args: PrArgs & { event: ZotzPrReviewEvent; body: string }) => {
      const repo = assertRegisteredGitHubRepo(args, store)
      if (!isPrNumber(args.prNumber) || !ZOTZ_PR_REVIEW_EVENTS.includes(args.event)) {
        return { ok: false, error: 'Invalid review' }
      }
      const result = await submitPRReview(
        repo.path,
        args.prNumber,
        args.event,
        typeof args.body === 'string' ? args.body : '',
        getGitHubRepoConnectionId(repo),
        args.prRepo ?? null,
        ...getGitHubLocalGitOptionArgs(store, repo)
      )
      if (result.ok) {
        broadcastGitHubWorkItemMutation(
          { repoPath: repo.path, repoId: repo.id, type: 'pr', number: args.prNumber },
          event.sender.id
        )
      }
      return result
    }
  )
}
