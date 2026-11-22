import { translate } from '@/i18n/i18n'

/** Getting Started's task step points at the Zotz board instead of Orca's integrations list. */
export function getZotzTaskSourcesStepCopy(): { name: string; description: string } {
  return {
    name: translate('zotz.tours.checklist.taskSources.name', 'Fill your task board'),
    description: translate(
      'zotz.tours.checklist.taskSources.description',
      'Bring in GitHub Projects, repos or a task service, then hand any task to an agent in one click.'
    )
  }
}
