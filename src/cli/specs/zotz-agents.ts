import type { CommandSpec } from '../discovery/command-spec'
import { CLI_GLOBAL_FLAGS as GLOBAL_FLAGS } from '../../shared/cli-argument-boundary'

export const ZOTZ_AGENTS_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['agent', 'list'],
    summary: 'List the conversations on this machine with their short names and chat addresses',
    usage: 'orca agent list [--environment <server>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'One line per conversation: short name, agent, state (working, waiting, done, idle), title, project and the address of its open chat.',
      'Write to one with orca orchestration send --to wt:<short name>; a conversation without an open chat cannot take mail.',
      'With --environment it lists that paired server instead; mail its conversations with --to wt:<short name> --on "<server>".'
    ],
    examples: ['orca agent list', 'orca agent list --environment "MSI Server" --json']
  }
]
