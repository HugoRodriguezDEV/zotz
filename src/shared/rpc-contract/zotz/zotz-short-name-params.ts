import { z } from 'zod'

export const ZotzShortNamesListParams = z.object({})

// An empty shortName clears the custom name back to the folder name.
export const ZotzShortNameSetParams = z.object({
  path: z.string().min(1).max(4096),
  shortName: z.string().max(256)
})
