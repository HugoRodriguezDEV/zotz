import { useMemo } from 'react'
import { useIntlLocale } from '@/i18n/use-translate'
import type {
  GitHubProjectRow,
  GitHubProjectTable
} from '../../../../../shared/github/projects/project-types'
import type { ZotzTaskBoardItem } from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import {
  githubRowFieldValues,
  sumZotzTaskField
} from '../../../../../shared/zotz/tasks/zotz-task-fields'
import type { ZotzTaskFacts } from '../../../../../shared/zotz/tasks/zotz-task-filter'

export type ZotzTaskSummarize = (items: readonly ZotzTaskBoardItem[]) => string | null

/** "Estimate: 13" for the view's sum field over some tasks; null when the view sums nothing. */
export function useZotzTaskSummary(
  fieldName: string | null,
  facts: ReadonlyMap<string, ZotzTaskFacts>
): {
  items: ZotzTaskSummarize | undefined
  rows: ((rows: readonly GitHubProjectRow[], table: GitHubProjectTable) => string) | undefined
} {
  const locale = useIntlLocale()
  return useMemo(() => {
    if (!fieldName) {
      return { items: undefined, rows: undefined }
    }
    const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
    const label = (total: number): string => `${fieldName}: ${format.format(total)}`
    return {
      items: (items) =>
        label(
          sumZotzTaskField(
            items.map((item) => facts.get(item.key)?.fields),
            fieldName
          )
        ),
      rows: (rows, table) =>
        label(
          sumZotzTaskField(
            rows.map((row) => githubRowFieldValues(row, table)),
            fieldName
          )
        )
    }
  }, [facts, fieldName, locale])
}
