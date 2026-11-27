import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import {
  getGitHubRepoRoutingTarget,
  getGitHubRuntimeRepoId
} from '@/lib/work-items/github/github-source-runtime-context'
import { notifyWorkItemDetailsMutation } from '@/components/github/github-work-item-comment-mutations'
import { codeHostErrorText } from '@/lib/source-control/remote/code-host-error-copy'
import { translate } from '@/i18n/i18n'
import type { TaskSourceContext } from '../../../../../shared/work-items/task-source-context'
import type { GitHubRepositoryIdentity as GitHubOwnerRepo } from '../../../../../shared/github/repositories/repository-identity'
import type { ZotzPrReviewEvent } from '../../../../../shared/zotz/zotz-pr-review'

export type ZotzPrContext = {
  repoPath: string | null
  repoId: string | null
  sourceContext?: TaskSourceContext | null
  prNumber: number
  prRepo?: GitHubOwnerRepo | null
}

type PrResult = { ok: true } | { ok: false; error: string; errorDetail?: string }

/** Where the PR's repo lives decides IPC or the paired server's RPC, as close/merge do. */
export function canRunZotzPrAction(ctx: ZotzPrContext): boolean {
  const target = getGitHubRepoRoutingTarget(useAppStore.getState(), ctx.repoId, ctx.sourceContext)
  return target.kind === 'environment' || Boolean(ctx.repoPath)
}

function errorMessage(res: { ok: false; error: string; errorDetail?: string }): string {
  return /own pull request/i.test(`${res.error} ${res.errorDetail ?? ''}`)
    ? translate(
        'zotz.prReview.ownPr',
        "GitHub doesn't let you approve or request changes on your own pull request."
      )
    : codeHostErrorText(res)
}

async function runPrAction(
  ctx: ZotzPrContext,
  method: 'github.markPRDraft' | 'github.markPRReadyForReview' | 'github.submitPRReview',
  local: (args: {
    repoPath: string
    repoId?: string
    sourceContext?: TaskSourceContext | null
    prNumber: number
    prRepo: GitHubOwnerRepo | null
  }) => Promise<PrResult>,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const target = getGitHubRepoRoutingTarget(useAppStore.getState(), ctx.repoId, ctx.sourceContext)
  const res =
    target.kind === 'environment'
      ? await callRuntimeRpc<PrResult>(
          target,
          method,
          {
            repo: getGitHubRuntimeRepoId(ctx.sourceContext, ctx.repoId ?? ''),
            prNumber: ctx.prNumber,
            prRepo: ctx.prRepo ?? null,
            ...extra
          },
          { timeoutMs: 30_000 }
        )
      : await local({
          repoPath: ctx.repoPath ?? '',
          repoId: ctx.repoId ?? undefined,
          sourceContext: ctx.sourceContext,
          prNumber: ctx.prNumber,
          prRepo: ctx.prRepo ?? null
        })
  if (!res.ok) {
    throw new Error(errorMessage(res))
  }
  if (target.kind === 'environment') {
    notifyWorkItemDetailsMutation(
      {
        repoPath: ctx.repoPath ?? '',
        repoId: ctx.repoId ?? undefined,
        sourceContext: ctx.sourceContext,
        type: 'pr',
        number: ctx.prNumber
      },
      { local: false }
    )
  }
}

export function setZotzPrDraft(ctx: ZotzPrContext, draft: boolean): Promise<void> {
  return draft
    ? runPrAction(ctx, 'github.markPRDraft', (args) => window.api.gh.markPRDraft(args))
    : runPrAction(ctx, 'github.markPRReadyForReview', (args) =>
        window.api.gh.markPRReadyForReview(args)
      )
}

export function submitZotzPrReview(
  ctx: ZotzPrContext,
  event: ZotzPrReviewEvent,
  body: string
): Promise<void> {
  return runPrAction(
    ctx,
    'github.submitPRReview',
    (args) => window.api.gh.submitPRReview({ ...args, event, body }),
    { event, body }
  )
}
