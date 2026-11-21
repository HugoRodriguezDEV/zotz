import { translate } from '@/i18n/i18n'
import type { ZOTZ_CONTEXTUAL_TOURS } from '../../../../../shared/zotz/feature-education/zotz-contextual-tours'

type ZotzTourStepId = (typeof ZOTZ_CONTEXTUAL_TOURS)[number]['steps'][number]['id']
type StepCopy = { title: string; body: string }

const step = (key: string, title: string, body: string) => (): StepCopy => ({
  title: translate(`zotz.tours.${key}.title`, title),
  body: translate(`zotz.tours.${key}.body`, body)
})

/** Thunks so translate() resolves in the language active when the step renders. */
export const ZOTZ_CONTEXTUAL_TOUR_STEP_COPY = {
  'zotz-sidebar-tasks': step(
    'sidebarTasks',
    'Your tasks, in one board',
    'Tasks opens the board with every GitHub Project, repo and service you connect.'
  ),
  'zotz-sidebar-new-conversation': step(
    'sidebarNewConversation',
    'One conversation, one worktree',
    'Click + next to a project to start a conversation on its own branch, on this machine or a server.'
  ),
  'zotz-sidebar-conversation-actions': step(
    'sidebarConversationActions',
    'Keep the list short',
    'Right-click a conversation to give it a short name agents can use, archive it or delete it after reviewing its changes.'
  ),
  'zotz-task-board-sources-intro': step(
    'taskBoardSourcesIntro',
    'Choose where tasks come from',
    'Pick GitHub Projects, repos without a Project, or an external service. Zotz only reads them.'
  ),
  'zotz-task-board-views': step(
    'taskBoardViews',
    'Save the views you use',
    'Each tab keeps its own filter, grouping and layout, like a GitHub Projects view.'
  ),
  'zotz-task-board-filter': step(
    'taskBoardFilter',
    'Filter like on GitHub',
    'Type the same syntax: is:open, assignee:@me, label:bug.'
  ),
  'zotz-task-board-layouts': step(
    'taskBoardLayouts',
    'Board, table or roadmap',
    'Switch layouts without losing the filter. Roadmap uses the start and target dates of your Projects.'
  ),
  'zotz-task-board-card': step(
    'taskBoardCard',
    'From task to agent',
    'Open a task to see its linked PRs and branches, then create a workspace with it to hand it to an agent.'
  ),
  'zotz-task-board-sources': step(
    'taskBoardSources',
    'Add more sources',
    'Add Projects, repos or services here at any time.'
  ),
  'zotz-agent-queue-segment': step(
    'agentQueueSegment',
    'Agents wait for memory',
    'Before launching an agent Zotz checks free memory. If there is not enough, the agent waits in line and starts on its own when memory frees up. Click to see the queue.'
  ),
  'zotz-agent-queue-board-memory': step(
    'agentQueueBoardMemory',
    'Memory of every machine',
    'Each paired server shows its own free memory and its own line, next to this one.'
  ),
  'zotz-agent-queue-board-backlog': step(
    'agentQueueBoardBacklog',
    'Waiting agents',
    'Manual launches go first, then the ones sent from another machine, then automations. Launch one anyway or cancel it from its card.'
  ),
  'zotz-background-sonar': step(
    'backgroundSonar',
    'Still working in the background',
    'This echo means the agent finished its turn but left tests, scripts or subagents running.'
  ),
  'zotz-background-tab': step(
    'backgroundTab',
    'See and stop that work',
    'The Background tab shows each task with its output and a Stop button.'
  )
} satisfies Record<ZotzTourStepId, () => StepCopy>
