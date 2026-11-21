import { defineMethod } from '../../core'
import { ZotzTasksPushParams } from '../../../../../shared/rpc-contract/zotz/zotz-tasks-params'
import { pushZotzTasksDocument } from '../../../../zotz/tasks/zotz-task-connector-registry'

/** `zotz tasks push`: an external service's document lands on the task board as a connector. */
export const ZOTZ_TASKS_PUSH_METHOD = defineMethod({
  name: 'zotz.tasks.push',
  permission: 'workspace',
  params: ZotzTasksPushParams,
  handler: async ({ text, format }) => pushZotzTasksDocument(text, format)
})

export const ZOTZ_TASKS_METHODS = [ZOTZ_TASKS_PUSH_METHOD] as const
