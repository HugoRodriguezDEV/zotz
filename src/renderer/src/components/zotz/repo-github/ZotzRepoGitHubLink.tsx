import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GitHubIcon } from '@/components/icons/GitHubIcon'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import { buildGitHubRepoUrl } from '../../../../../shared/github/repositories/links'
import type { GitHubRepositoryIdentity } from '../../../../../shared/github/repositories/repository-identity'
import { formatZotzRepoSlug } from './use-zotz-repo-github-slug'

/** GitHub mark that names the repository and opens it in the browser. */
export function ZotzRepoGitHubLink({
  slug,
  className,
  iconClassName,
  children
}: {
  slug: GitHubRepositoryIdentity
  className?: string
  iconClassName?: string
  children?: React.ReactNode
}): React.JSX.Element {
  const t = useTranslate()
  const name = formatZotzRepoSlug(slug)
  const label = t('zotz.repoGitHub.open', 'Open {{repo}} on GitHub', { repo: name })
  const url = buildGitHubRepoUrl(slug)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            'inline-flex min-w-0 shrink-0 cursor-pointer items-center gap-1 rounded transition-colors hover:text-foreground',
            className
          )}
          onClick={(event) => {
            event.stopPropagation()
            if (url) {
              openAppHttpLink(url, { destination: 'system' })
            }
          }}
        >
          <GitHubIcon className={cn('size-3.5 shrink-0', iconClassName)} />
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
