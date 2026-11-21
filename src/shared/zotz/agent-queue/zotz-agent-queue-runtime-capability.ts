import {
  ZOTZ_CONVERSATIONS_RUNTIME_CAPABILITY,
  ZOTZ_LINKS_RUNTIME_CAPABILITY
} from '../conversation-links/zotz-conversation-links-contract'

// Why: a paired client reads another host's memory queue only when that host declares it; older hosts omit it.
export const ZOTZ_AGENT_QUEUE_RUNTIME_CAPABILITY = 'zotz.agent-queue.v1' as const

// Why separate: a host that publishes its queue may predate the calls that cancel or force a launch.
export const ZOTZ_AGENT_QUEUE_CONTROL_RUNTIME_CAPABILITY = 'zotz.agent-queue-control.v1' as const

// Why: a client edits another host's short names only when that host keeps them; older hosts show folder names.
export const ZOTZ_SHORT_NAMES_RUNTIME_CAPABILITY = 'zotz.short-names.v1' as const

// Why: `zotz tasks push` to a paired server should say "update that server" instead of a bare RPC error.
export const ZOTZ_TASKS_PUSH_RUNTIME_CAPABILITY = 'zotz.tasks-push.v1' as const

export const ZOTZ_RUNTIME_CAPABILITIES = [
  ZOTZ_AGENT_QUEUE_RUNTIME_CAPABILITY,
  ZOTZ_AGENT_QUEUE_CONTROL_RUNTIME_CAPABILITY,
  ZOTZ_SHORT_NAMES_RUNTIME_CAPABILITY,
  ZOTZ_TASKS_PUSH_RUNTIME_CAPABILITY,
  ZOTZ_CONVERSATIONS_RUNTIME_CAPABILITY,
  ZOTZ_LINKS_RUNTIME_CAPABILITY
] as const
