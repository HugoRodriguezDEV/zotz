import type {
  FeatureWallWorkflow,
  FeatureWallWorkflowId
} from '../../feature-education/explore/feature-wall-workflows'
import { ZOTZ_RELEASE_REPO } from '../zotz-app-identity'

export type ZotzFeatureWallWorkflowId = 'zotz-node' | 'zotz-queue'

const ZOTZ_DOCS = `https://github.com/${ZOTZ_RELEASE_REPO}/blob/main/docs/zotz`

const ZOTZ_WORKFLOWS: readonly FeatureWallWorkflow[] = [
  {
    id: 'zotz-node',
    title: '24/7 node',
    meta: 'Server mode · Tailscale',
    lede: 'Leave one machine on as an agent node and send it work from your laptop or phone over Tailscale.',
    primaryTileId: 'tile-06',
    relatedTileIds: [],
    docsUrl: `${ZOTZ_DOCS}/NODE-SETUP.md`
  },
  {
    id: 'zotz-queue',
    title: 'Memory & queue',
    meta: 'Memory governor · Every machine',
    lede: 'Zotz launches an agent only when it fits in memory; the rest wait their turn and start on their own.',
    primaryTileId: 'tile-04',
    relatedTileIds: [],
    docsUrl: `${ZOTZ_DOCS}/PLAN.md`
  }
]

const ZOTZ_TASKS_WORKFLOW: Partial<FeatureWallWorkflow> = {
  meta: 'GitHub Projects · Repos · Services',
  lede: 'See every task in one board and hand any of them to an agent in its own workspace.',
  docsUrl: `${ZOTZ_DOCS}/TASKS-SPEC.md`
}

/** What Zotz is for goes first: the node and its queue, then the task board and Orca's workflows. */
export function withZotzFeatureWallWorkflows(
  upstream: readonly FeatureWallWorkflow[]
): readonly FeatureWallWorkflow[] {
  const tasks = upstream.filter((workflow) => workflow.id === 'tasks')
  const rest = upstream.filter((workflow) => workflow.id !== 'tasks')
  return [
    ...ZOTZ_WORKFLOWS,
    ...tasks.map((workflow) => ({ ...workflow, ...ZOTZ_TASKS_WORKFLOW })),
    ...rest
  ]
}

export const ZOTZ_DEFAULT_FEATURE_WALL_WORKFLOW_ID: FeatureWallWorkflowId = 'zotz-node'

export function isZotzFeatureWallWorkflowId(id: string): id is ZotzFeatureWallWorkflowId {
  return id === 'zotz-node' || id === 'zotz-queue'
}
