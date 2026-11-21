import type { CommandHandler, HandlerContext } from '../dispatch/dispatch'
import { getOptionalStringFlagAllowingEmpty } from '../arguments/flags'
import { getRequiredWorktreeSelector } from '../workspace-selection/workspace-selector'
import { printResult } from '../output/command-result-output'
import { RuntimeClientError } from '../runtime/connection/types'
import type { RuntimeWorktreeRecord } from '../../shared/worktree/catalog/runtime-worktree-contracts'
import type { ZotzShortNameSetResult } from '../../shared/zotz/zotz-short-name'

// The `worktree set` flags that still need `worktree.set` after the short name is saved.
const WORKTREE_SET_FIELD_FLAGS = [
  'display-name',
  'issue',
  'pr',
  'linear-issue',
  'gitlab-issue',
  'gitlab-mr',
  'comment',
  'workspace-status',
  'unread',
  'read',
  'parent-worktree',
  'parent-environment',
  'no-parent'
]

/** `worktree set --short-name <name>` (empty goes back to the folder name). True when nothing else is left to set. */
async function setZotzWorktreeShortName({
  client,
  flags,
  cwd,
  json
}: HandlerContext): Promise<boolean> {
  const shortName = getOptionalStringFlagAllowingEmpty(flags, 'short-name')
  if (shortName === undefined) {
    return false
  }
  const worktree = await getRequiredWorktreeSelector(flags, 'worktree', cwd, client)
  const shown = await client.call<{ worktree: RuntimeWorktreeRecord }>('worktree.show', {
    worktree
  })
  const response = await client.call<ZotzShortNameSetResult>('zotz.shortNames.set', {
    path: shown.result.worktree.path,
    shortName
  })
  if (!response.result.ok) {
    throw new RuntimeClientError(
      'invalid_argument',
      response.result.reason === 'taken'
        ? `Another workspace on that machine is already called "${shortName}".`
        : `"${shortName}" is not a valid short name; use letters, digits and -.`
    )
  }
  if (WORKTREE_SET_FIELD_FLAGS.some((flag) => flags.has(flag))) {
    return false
  }
  const path = shown.result.worktree.path
  printResult(response, json, (result) =>
    result.names[path] ? `short name: ${result.names[path]}` : 'short name: folder name'
  )
  return true
}

/** Adds `--short-name` to upstream's `worktree set` without touching its handler. */
export function withZotzWorktreeShortName(
  handlers: Record<string, CommandHandler>
): Record<string, CommandHandler> {
  const set = handlers['worktree set']
  return {
    ...handlers,
    'worktree set': async (ctx) => {
      if (!(await setZotzWorktreeShortName(ctx))) {
        await set?.(ctx)
      }
    }
  }
}
