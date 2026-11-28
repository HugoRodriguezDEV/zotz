import type { CommandSpec } from '../discovery/command-spec'
import { CLI_GLOBAL_FLAGS as GLOBAL_FLAGS } from '../../shared/cli-argument-boundary'

export const ZOTZ_FLOWS_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['flows', 'list'],
    summary: 'List the flows stored on this Zotz',
    usage: 'orca flows list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: ['With --environment the list comes from that paired server, where its flows run.'],
    examples: ['orca flows list']
  },
  {
    path: ['flows', 'run'],
    summary: 'Run a flow by hand',
    usage: 'orca flows run <slug> [--input name=value ...] [--wait] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'slug', 'input', 'wait'],
    positionalArgs: ['slug'],
    repeatableFlags: ['input'],
    notes: [
      'Repeat --input for each field; values are converted to the type the manual trigger declares.',
      '--wait follows the run until it ends and prints the state of every step.'
    ],
    examples: [
      'orca flows run revisar-pr --input pr=123 --wait',
      'orca flows run limpieza --environment msi'
    ]
  },
  {
    path: ['flows', 'runs'],
    summary: 'Show the recent runs of a flow with the state of each step',
    usage: 'orca flows runs <slug> [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'slug', 'limit'],
    positionalArgs: ['slug'],
    examples: ['orca flows runs revisar-pr --limit 3']
  },
  {
    path: ['flows', 'export'],
    summary: 'Print a flow as a zotz-flow/v1 file',
    usage: 'orca flows export <slug> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'slug'],
    positionalArgs: ['slug'],
    examples: ['orca flows export revisar-pr > revisar-pr.zotz-flow.json']
  },
  {
    path: ['flows', 'import'],
    summary: 'Save a zotz-flow/v1 file as a flow',
    usage: 'orca flows import <file> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'file'],
    positionalArgs: ['file'],
    notes: [
      'A flow with the same id is replaced; use --file - to read the file from stdin.',
      'The flow is checked before saving: errors block it, warnings are listed.'
    ],
    examples: ['orca flows import revisar-pr.zotz-flow.json']
  }
]
