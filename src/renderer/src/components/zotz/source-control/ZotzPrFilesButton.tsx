import React from 'react'
import { FileDiff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'
import type { GitHubWorkItem } from '../../../../../shared/github/work-items/work-item-types'
import type { HostedReviewInfo } from '../../../../../shared/source-control/hosted-review/hosted-review-contracts'
import type { Repo } from '../../../../../shared/repository/repo-types'

/** Opens the PR's files tab inside Zotz, so reviewing a diff never needs the browser. */
export function ZotzPrFilesButton({
  review,
  repo
}: {
  review: HostedReviewInfo
  repo: Repo
}): React.JSX.Element | null {
  const t = useTranslate()
  const openTaskPage = useAppStore((s) => s.openTaskPage)
  if (review.provider !== 'github') {
    return null
  }
  const open = (): void => {
    const item: GitHubWorkItem = {
      id: review.url,
      type: 'pr',
      number: review.number,
      title: review.title,
      state: review.state,
      url: review.url,
      labels: [],
      updatedAt: review.updatedAt,
      author: null,
      headSha: review.headSha,
      prRepo: review.githubRepository,
      repoId: repo.id
    }
    openTaskPage({
      taskSource: 'github',
      preselectedRepoId: repo.id,
      openGitHubWorkItem: item,
      openGitHubInitialTab: 'files'
    })
  }
  return (
    <Button type="button" variant="outline" size="sm" className="w-full" onClick={open}>
      <FileDiff className="size-3.5" />
      {t('zotz.prFiles.open', 'Files changed')}
    </Button>
  )
}
