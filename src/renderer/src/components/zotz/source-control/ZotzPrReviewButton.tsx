import React, { useState } from 'react'
import { ChevronDown, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslate } from '@/i18n/use-translate'
import type { GitHubWorkItem } from '../../../../../shared/github/work-items/work-item-types'
import { ZotzPrReviewControls } from './ZotzPrReviewControls'
import { canRunZotzPrAction, type ZotzPrContext } from './zotz-pr-review-actions'

/** GitHub's "Review changes" for the PR page: reachable from every tab, files included. */
export function ZotzPrReviewButton({
  pr,
  state,
  onStateChange,
  onMutated
}: {
  pr: ZotzPrContext
  state: GitHubWorkItem['state']
  onStateChange: (state: GitHubWorkItem['state']) => void
  onMutated: () => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  if ((state !== 'open' && state !== 'draft') || !canRunZotzPrAction(pr)) {
    return null
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" className="my-1.5 ml-auto">
          <ClipboardCheck className="size-3.5" />
          {t('zotz.prReview.open', 'Review')}
          <ChevronDown className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[30rem]">
        <ZotzPrReviewControls
          pr={pr}
          state={state}
          onStatePatch={onStateChange}
          onMutated={() => {
            setOpen(false)
            onMutated()
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
