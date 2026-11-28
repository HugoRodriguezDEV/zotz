import React, { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, CircleAlert, CircleCheck } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import type { ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import { describeZotzFlowProblem, type ZotzFlowCanvasProblem } from './zotz-flow-problems-view'
import type { ZotzFlowSelection } from './use-zotz-flow-editor-state'

function targetOf(problem: ZotzFlowCanvasProblem): ZotzFlowSelection {
  if (problem.edgeId) {
    return { kind: 'edge', id: problem.edgeId }
  }
  if (problem.nodeId) {
    return { kind: 'node', id: problem.nodeId }
  }
  if (problem.code === 'invalid_field' && problem.triggerId) {
    return { kind: 'triggers', triggerId: problem.triggerId }
  }
  return null
}

/** Problems carry no id; their target and text identify them, numbered when repeated. */
function keyedProblems(
  problems: readonly ZotzFlowCanvasProblem[]
): { problem: ZotzFlowCanvasProblem; key: string }[] {
  const seen = new Map<string, number>()
  return problems.map((problem) => {
    const base = [
      problem.code,
      problem.nodeId,
      problem.edgeId,
      problem.field,
      problem.message
    ].join('\0')
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return { problem, key: `${base}\0${count}` }
  })
}

/** Live list under the canvas; pressing a problem selects what it points at. */
export function ZotzFlowProblemsPanel({
  draft,
  problems,
  onSelect
}: {
  draft: ZotzFlowDraft
  problems: readonly ZotzFlowCanvasProblem[]
  onSelect: (selection: ZotzFlowSelection) => void
}): React.JSX.Element {
  const t = useTranslate()
  const [open, setOpen] = useState(true)
  const errors = problems.filter((problem) => problem.severity === 'error').length
  const warnings = problems.length - errors
  const names = new Map(draft.nodes.map((node) => [node.id, node.name]))
  const summary =
    problems.length === 0
      ? t('zotz.flows.problems.none', 'No problems')
      : t('zotz.flows.problems.count', '{errors} errors · {warnings} warnings')
          .replace('{errors}', String(errors))
          .replace('{warnings}', String(warnings))
  return (
    <div className="shrink-0 border-t border-border bg-card">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => setOpen((value) => !value)}
      >
        {problems.length === 0 ? (
          <CircleCheck className="size-4 text-status-success" />
        ) : errors > 0 ? (
          <CircleAlert className="size-4 text-destructive" />
        ) : (
          <AlertTriangle className="size-4 text-status-warning" />
        )}
        <span className="flex-1">{summary}</span>
        {problems.length > 0 ? (
          open ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronUp className="size-4" />
          )
        ) : null}
      </button>
      {open && problems.length > 0 ? (
        <ul className="max-h-40 overflow-y-auto px-2 pb-2 scrollbar-sleek">
          {keyedProblems(problems).map(({ problem, key }) => {
            const target = targetOf(problem)
            const Icon = problem.severity === 'error' ? CircleAlert : AlertTriangle
            const where = problem.nodeId ? names.get(problem.nodeId) : null
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={!target}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:hover:bg-transparent"
                  onClick={() => onSelect(target)}
                >
                  <Icon
                    className={
                      problem.severity === 'error'
                        ? 'mt-0.5 size-4 shrink-0 text-destructive'
                        : 'mt-0.5 size-4 shrink-0 text-status-warning'
                    }
                  />
                  {where ? <span className="shrink-0 font-mono font-medium">{where}</span> : null}
                  <span className="min-w-0 flex-1">{describeZotzFlowProblem(problem, t)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
