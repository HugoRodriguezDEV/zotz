import { translate } from '@/i18n/i18n'

type WorkflowCopy = { title: string; lede: string }

/** Zotz's own gallery workflows. */
export function getZotzFeatureWallWorkflowCopy(): Record<'zotz-node' | 'zotz-queue', WorkflowCopy> {
  return {
    'zotz-node': {
      title: translate('zotz.tours.featureWall.node.title', '24/7 node'),
      lede: translate(
        'zotz.tours.featureWall.node.lede',
        'Leave one machine on as an agent node and send it work from your laptop or phone over Tailscale.'
      )
    },
    'zotz-queue': {
      title: translate('zotz.tours.featureWall.queue.title', 'Memory & queue'),
      lede: translate(
        'zotz.tours.featureWall.queue.lede',
        'Zotz launches an agent only when it fits in memory; the rest wait their turn and start on their own.'
      )
    }
  }
}

export function getZotzTasksWorkflowCopy(): WorkflowCopy {
  return {
    title: translate('zotz.tours.featureWall.tasks.title', 'Task board'),
    lede: translate(
      'zotz.tours.featureWall.tasks.lede',
      'See every task in one board and hand any of them to an agent in its own workspace.'
    )
  }
}
