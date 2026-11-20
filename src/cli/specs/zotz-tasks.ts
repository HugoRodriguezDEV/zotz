import type { CommandSpec } from '../discovery/command-spec'
import { CLI_GLOBAL_FLAGS as GLOBAL_FLAGS } from '../../shared/cli-argument-boundary'
import { LOCAL_COMMAND_FLAGS } from '../arguments/args'

export const ZOTZ_TASKS_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['tasks', 'push'],
    summary: 'Send a zotz-tasks/v1 document to the task board',
    usage: 'orca tasks push --file <path> [--format json|yaml|toml] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'file', 'format'],
    notes: [
      'The document replaces what that source sent before; tasks it leaves out disappear from the board.',
      'Use --file - to read the document from stdin.',
      'With --environment the document goes to that paired server instead of this Zotz.'
    ],
    examples: [
      'orca tasks push --file tickets.json',
      'curl -s https://tickets.example.com/zotz-tasks.yaml | orca tasks push --file - --format yaml'
    ]
  },
  {
    path: ['tasks', 'validate'],
    summary: 'Check a zotz-tasks/v1 document without sending it',
    usage: 'orca tasks validate --file <path> [--format json|yaml|toml] [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'file', 'format'],
    notes: [
      'Runs locally, without Zotz running. Exits non-zero when the document itself is invalid.',
      'Tasks the board would skip are listed with their reason; the rest of the document is still valid.'
    ],
    examples: ['orca tasks validate --file tickets.toml']
  },
  {
    path: ['tasks', 'schema'],
    summary: 'Print the zotz-tasks/v1 JSON Schema',
    usage: 'orca tasks schema',
    allowedFlags: [...LOCAL_COMMAND_FLAGS],
    notes: [
      'Runs locally. Point your service or editor at this schema to validate before publishing.'
    ],
    examples: ['orca tasks schema > zotz-tasks-v1.schema.json']
  }
]
