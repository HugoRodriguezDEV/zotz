import { z } from 'zod'
import { ZOTZ_TASKS_MAX_BYTES } from '../../zotz/tasks/zotz-tasks-contract'

// Same 2 MB bound the feed reader and the file import apply.
export const ZotzTasksPushParams = z.object({
  text: z.string().min(1).max(ZOTZ_TASKS_MAX_BYTES),
  format: z.enum(['json', 'yaml', 'toml', 'auto']).default('auto')
})
