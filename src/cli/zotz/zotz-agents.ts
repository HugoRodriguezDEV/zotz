import type { CommandHandler } from '../dispatch/dispatch'
import { printResult } from '../output/command-result-output'
import { RuntimeClientError } from '../runtime/connection/types'
import type {
  ZotzConversationEntry,
  ZotzConversationsListResult
} from '../../shared/zotz/conversation-links/zotz-conversation-links-contract'

function formatConversations(conversations: readonly ZotzConversationEntry[]): string {
  if (conversations.length === 0) {
    return 'No conversations.'
  }
  const rows = conversations.map((row) => [
    row.shortName,
    row.agent ?? '-',
    row.state ?? '-',
    row.projectName ? `${row.title}  (${row.projectName})` : row.title,
    row.address ?? '-'
  ])
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)))
  return rows
    .map((row) =>
      row
        .map((cell, column) => (column === row.length - 1 ? cell : cell.padEnd(widths[column])))
        .join('  ')
    )
    .join('\n')
}

export const ZOTZ_AGENTS_HANDLERS: Record<string, CommandHandler> = {
  'agent list': async ({ client, json }) => {
    try {
      const response = await client.call<ZotzConversationsListResult>('zotz.conversations.list', {})
      printResult(response, json, (result) => formatConversations(result.conversations))
    } catch (error) {
      if (error instanceof RuntimeClientError && error.code === 'method_not_found') {
        throw new RuntimeClientError(
          'method_not_found',
          'That Zotz cannot list its conversations yet. Update it and try again.'
        )
      }
      throw error
    }
  }
}
