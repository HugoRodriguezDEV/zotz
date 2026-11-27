import { invalidateReviewLookupsAfterPRMutation } from '../../github/pull-requests/refresh/pr-mutation-review-invalidation'
import { acquire, release } from '../../github/execution/github-operation-slots'
import { classifyPullRequestUpdateError } from '../../github/api/gh-error-classification'
import { ghExecFileAsync } from '../../git/command-runner/hosted-cli/gh-exec-file'
import type { LocalGitExecOptions } from '../../github/repositories/github-repository-identity'
import { resolveGitHubRepoExecution } from '../../github/repositories/github-api-repository'
import type { GitHubRepositoryIdentity as GitHubApiRepository } from '../../../shared/github/repositories/repository-identity'
import { codeHostFailure, classifiedFailure } from '../../../shared/code-host-failure-copy'
import { zotzPrReviewNeedsBody, type ZotzPrReviewEvent } from '../../../shared/zotz/zotz-pr-review'

const EVENT_FLAG: Record<ZotzPrReviewEvent, string> = {
  approve: '--approve',
  'request-changes': '--request-changes',
  comment: '--comment'
}

/** `gh pr review`: approve, request changes or comment on a pull request. */
export async function submitPRReview(
  repoPath: string,
  prNumber: number,
  event: ZotzPrReviewEvent,
  body: string,
  connectionId?: string | null,
  prRepo?: GitHubApiRepository | null,
  localGitOptions: LocalGitExecOptions = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = body.trim()
  if (zotzPrReviewNeedsBody(event) && !trimmed) {
    return { ok: false, error: 'A comment is required for this review.' }
  }
  const { ownerRepo, ghOptions } = await resolveGitHubRepoExecution(
    repoPath,
    prRepo,
    connectionId,
    localGitOptions
  )
  if (!ownerRepo) {
    return codeHostFailure('github.repoUnresolved')
  }

  await acquire()
  try {
    await ghExecFileAsync(
      [
        'pr',
        'review',
        String(prNumber),
        '--repo',
        `${ownerRepo.owner}/${ownerRepo.repo}`,
        EVENT_FLAG[event],
        ...(trimmed ? ['--body', trimmed] : [])
      ],
      ghOptions
    )
    return { ok: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error'
    return classifiedFailure(classifyPullRequestUpdateError(message))
  } finally {
    invalidateReviewLookupsAfterPRMutation(repoPath, connectionId)
    release()
  }
}
