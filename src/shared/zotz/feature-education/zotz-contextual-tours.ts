import type { ContextualTour } from '../../feature-education/contextual-tours/contextual-tours'
import type { FeatureInteractionCategory } from '../../feature-education/interactions/feature-interaction-categories'

export type ZotzContextualTourId =
  | 'zotz-sidebar'
  | 'zotz-task-board-sources'
  | 'zotz-task-board'
  | 'zotz-agent-queue'
  | 'zotz-agent-queue-board'
  | 'zotz-background'

const target = (name: string): string => `[data-contextual-tour-target="${name}"]`

/** Tours for what Zotz adds on top of Orca; they run once on every profile, not only first-run ones. */
export const ZOTZ_CONTEXTUAL_TOURS = [
  {
    id: 'zotz-sidebar',
    steps: [
      {
        id: 'zotz-sidebar-tasks',
        title: 'Your tasks, in one board',
        body: 'Tasks opens the board with every GitHub Project, repo and service you connect.',
        targetSelector: target('zotz-sidebar-tasks'),
        requiredForStart: true,
        preferredPlacement: 'right'
      },
      {
        id: 'zotz-sidebar-new-conversation',
        title: 'One conversation, one worktree',
        body: 'Click + next to a project to start a conversation on its own branch, on this machine or a server.',
        targetSelector: target('zotz-project-new-conversation'),
        preferredPlacement: 'right'
      },
      {
        id: 'zotz-sidebar-conversation-actions',
        title: 'Keep the list short',
        body: 'Right-click a conversation to give it a short name agents can use, archive it or delete it after reviewing its changes.',
        targetSelector: target('zotz-conversation-row'),
        preferredPlacement: 'right'
      }
    ]
  },
  {
    id: 'zotz-task-board-sources',
    steps: [
      {
        id: 'zotz-task-board-sources-intro',
        title: 'Choose where tasks come from',
        body: 'Pick GitHub Projects, repos without a Project, or an external service. Zotz only reads them.',
        targetSelector: target('zotz-task-sources-empty'),
        requiredForStart: true,
        preferredPlacement: 'bottom'
      }
    ]
  },
  {
    id: 'zotz-task-board',
    steps: [
      {
        id: 'zotz-task-board-views',
        title: 'Save the views you use',
        body: 'Each tab keeps its own filter, grouping and layout, like a GitHub Projects view.',
        targetSelector: target('zotz-task-view-tabs'),
        requiredForStart: true,
        preferredPlacement: 'bottom'
      },
      {
        id: 'zotz-task-board-filter',
        title: 'Filter like on GitHub',
        body: 'Type the same syntax: is:open, assignee:@me, label:bug.',
        targetSelector: target('zotz-task-filter'),
        preferredPlacement: 'bottom'
      },
      {
        id: 'zotz-task-board-layouts',
        title: 'Board, table or roadmap',
        body: 'Switch layouts without losing the filter. Roadmap uses the start and target dates of your Projects.',
        targetSelector: target('zotz-task-layouts'),
        preferredPlacement: 'bottom'
      },
      {
        id: 'zotz-task-board-card',
        title: 'From task to agent',
        body: 'Open a task to see its linked PRs and branches, then create a workspace with it to hand it to an agent.',
        targetSelector: target('zotz-task-card'),
        preferredPlacement: 'right'
      },
      {
        id: 'zotz-task-board-sources',
        title: 'Add more sources',
        body: 'Add Projects, repos or services here at any time.',
        targetSelector: target('zotz-task-sources'),
        preferredPlacement: 'bottom'
      }
    ]
  },
  {
    id: 'zotz-agent-queue',
    steps: [
      {
        id: 'zotz-agent-queue-segment',
        title: 'Agents wait for memory',
        body: 'Before launching an agent Zotz checks free memory. If there is not enough, the agent waits in line and starts on its own when memory frees up. Click to see the queue.',
        targetSelector: target('zotz-agent-queue-segment'),
        requiredForStart: true,
        preferredPlacement: 'top'
      }
    ]
  },
  {
    id: 'zotz-agent-queue-board',
    steps: [
      {
        id: 'zotz-agent-queue-board-memory',
        title: 'Memory of every machine',
        body: 'Each paired server shows its own free memory and its own line, next to this one.',
        targetSelector: target('zotz-agent-queue-memory'),
        requiredForStart: true,
        preferredPlacement: 'bottom'
      },
      {
        id: 'zotz-agent-queue-board-backlog',
        title: 'Waiting agents',
        body: 'Manual launches go first, then the ones sent from another machine, then automations. Launch one anyway or cancel it from its card.',
        targetSelector: target('zotz-agent-queue-backlog'),
        preferredPlacement: 'right'
      }
    ]
  },
  {
    id: 'zotz-background',
    steps: [
      {
        id: 'zotz-background-sonar',
        title: 'Still working in the background',
        body: 'This echo means the agent finished its turn but left tests, scripts or subagents running.',
        targetSelector: target('zotz-background-sonar'),
        requiredForStart: true,
        preferredPlacement: 'right'
      },
      {
        id: 'zotz-background-tab',
        title: 'See and stop that work',
        body: 'The Background tab shows each task with its output and a Stop button.',
        targetSelector: '[data-activity-item-id="zotz-background"]',
        preferredPlacement: 'left'
      }
    ]
  }
] as const satisfies readonly (ContextualTour & { id: ZotzContextualTourId })[]

export const ZOTZ_CONTEXTUAL_TOUR_SOURCES = {
  'zotz-sidebar': 'zotz_sidebar_visible',
  'zotz-task-board-sources': 'zotz_task_board_empty',
  'zotz-task-board': 'zotz_task_board_visible',
  'zotz-agent-queue': 'zotz_agent_running',
  'zotz-agent-queue-board': 'zotz_agent_queue_open',
  'zotz-background': 'zotz_background_work'
} as const satisfies Record<ZotzContextualTourId, string>

// Tuples so telemetry enums built from upstream lists keep their literal types.
export const ZOTZ_CONTEXTUAL_TOUR_IDS = [
  'zotz-sidebar',
  'zotz-task-board-sources',
  'zotz-task-board',
  'zotz-agent-queue',
  'zotz-agent-queue-board',
  'zotz-background'
] as const satisfies readonly ZotzContextualTourId[]

export const ZOTZ_CONTEXTUAL_TOUR_SOURCE_VALUES = [
  'zotz_sidebar_visible',
  'zotz_task_board_empty',
  'zotz_task_board_visible',
  'zotz_agent_running',
  'zotz_agent_queue_open',
  'zotz_background_work'
] as const satisfies readonly (typeof ZOTZ_CONTEXTUAL_TOUR_SOURCES)[ZotzContextualTourId][]

export function isZotzContextualTourId(id: string): id is ZotzContextualTourId {
  return id in ZOTZ_CONTEXTUAL_TOUR_SOURCES
}

// Each tour records its surface as a feature interaction, like upstream tours do.
export const ZOTZ_FEATURE_INTERACTIONS = [
  { id: 'zotz-sidebar', interaction: 'Zotz project sidebar shown with projects' },
  { id: 'zotz-task-board-sources', interaction: 'task board opened without sources' },
  { id: 'zotz-task-board', interaction: 'task board opened with tasks' },
  { id: 'zotz-agent-queue', interaction: 'agent launched under the memory governor' },
  { id: 'zotz-agent-queue-board', interaction: 'agent queue board opened' },
  { id: 'zotz-background', interaction: 'conversation left background work running' }
] as const satisfies readonly { id: ZotzContextualTourId; interaction: string }[]

export const ZOTZ_FEATURE_INTERACTION_CATEGORY_BY_ID = {
  'zotz-sidebar': 'workspace',
  'zotz-task-board-sources': 'task_management',
  'zotz-task-board': 'task_management',
  'zotz-agent-queue': 'resource_management',
  'zotz-agent-queue-board': 'resource_management',
  'zotz-background': 'agent'
} as const satisfies Record<ZotzContextualTourId, FeatureInteractionCategory>
