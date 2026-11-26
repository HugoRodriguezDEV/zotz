import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  Check,
  CircleAlert,
  GitPullRequestArrow,
  GitPullRequestDraft,
  LoaderCircle,
  MessageSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTranslate } from '@/i18n/use-translate'
import {
  zotzPrReviewNeedsBody,
  type ZotzPrReviewEvent
} from '../../../../../shared/zotz/zotz-pr-review'
import {
  canRunZotzPrAction,
  setZotzPrDraft,
  submitZotzPrReview,
  type ZotzPrContext
} from './zotz-pr-review-actions'

type Pending = 'draft' | ZotzPrReviewEvent | null

/** GitHub's review box plus the draft/ready switch, for the PR page and the PR panel. */
export function ZotzPrReviewControls({
  pr,
  state,
  showMarkReady = true,
  onStatePatch,
  onMutated
}: {
  pr: ZotzPrContext
  state: 'open' | 'closed' | 'merged' | 'draft'
  /** The PR panel already offers "Mark ready" for drafts. */
  showMarkReady?: boolean
  onStatePatch?: (state: 'open' | 'draft') => void
  onMutated: () => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const [body, setBody] = useState('')
  const [pending, setPending] = useState<Pending>(null)
  if ((state !== 'open' && state !== 'draft') || !canRunZotzPrAction(pr)) {
    return null
  }
  const busy = pending !== null

  const toggleDraft = async (): Promise<void> => {
    const draft = state === 'open'
    setPending('draft')
    onStatePatch?.(draft ? 'draft' : 'open')
    try {
      await setZotzPrDraft(pr, draft)
      toast.success(
        draft
          ? t('zotz.prReview.markedDraft', 'Pull request moved to draft')
          : t('zotz.prReview.markedReady', 'Pull request ready for review')
      )
      onMutated()
    } catch (error) {
      onStatePatch?.(state)
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setPending(null)
    }
  }

  const submit = async (event: ZotzPrReviewEvent): Promise<void> => {
    setPending(event)
    try {
      await submitZotzPrReview(pr, event, body)
      setBody('')
      toast.success(
        event === 'approve'
          ? t('zotz.prReview.approved', 'Pull request approved')
          : event === 'request-changes'
            ? t('zotz.prReview.changesRequested', 'Changes requested')
            : t('zotz.prReview.commented', 'Review comment sent')
      )
      onMutated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setPending(null)
    }
  }

  const spinnerOr = (kind: Pending, icon: React.ReactNode): React.ReactNode =>
    pending === kind ? <LoaderCircle className="size-3.5 animate-spin" /> : icon
  const needsText = (event: ZotzPrReviewEvent): boolean =>
    zotzPrReviewNeedsBody(event) && !body.trim()

  return (
    <div className="space-y-2" data-zotz-pr-review="">
      {state === 'open' || showMarkReady ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={busy}
          onClick={() => void toggleDraft()}
        >
          {state === 'open'
            ? spinnerOr('draft', <GitPullRequestDraft className="size-3.5" />)
            : spinnerOr('draft', <GitPullRequestArrow className="size-3.5" />)}
          {state === 'open'
            ? t('zotz.prReview.markDraft', 'Convert to draft')
            : t('zotz.prReview.markReady', 'Ready for review')}
        </Button>
      ) : null}
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t('zotz.prReview.placeholder', 'Leave a review comment')}
        aria-label={t('zotz.prReview.placeholder', 'Leave a review comment')}
        rows={3}
        disabled={busy}
        className="min-h-16 resize-y"
      />
      <div className="grid grid-cols-3 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || needsText('comment')}
          onClick={() => void submit('comment')}
        >
          {spinnerOr('comment', <MessageSquare className="size-3.5" />)}
          {t('zotz.prReview.comment', 'Comment')}
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={() => void submit('approve')}>
          {spinnerOr('approve', <Check className="size-3.5" />)}
          {t('zotz.prReview.approve', 'Approve')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || needsText('request-changes')}
          onClick={() => void submit('request-changes')}
        >
          {spinnerOr('request-changes', <CircleAlert className="size-3.5" />)}
          {t('zotz.prReview.requestChanges', 'Request changes')}
        </Button>
      </div>
    </div>
  )
}
