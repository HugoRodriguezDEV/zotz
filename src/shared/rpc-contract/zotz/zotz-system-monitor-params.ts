import { z } from 'zod'

export const ZotzSystemMonitorSubscribeParams = z.object({})

export const ZotzSystemMonitorProcessesParams = z.object({})

export const ZotzSystemMonitorProcessParams = z.object({ pid: z.number().int().positive() })

export const ZotzSystemMonitorCloseProcessParams = z.object({
  pid: z.number().int().positive(),
  name: z.string().min(1).max(4096),
  force: z.boolean()
})
