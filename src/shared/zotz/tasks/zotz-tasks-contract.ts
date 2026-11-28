import { z } from 'zod'
import { parse as parseYaml } from 'yaml'
import { parse as parseToml } from 'smol-toml'

/** The contract external task services send Zotz. See docs/zotz/specs/TASKS-SPEC.md §7. */
export const ZOTZ_TASKS_SCHEMA = 'zotz-tasks/v1'
export const ZOTZ_TASKS_MAX_BYTES = 2 * 1024 * 1024
export const ZOTZ_TASKS_MAX_TASKS = 2000

const GITHUB_COLORS = [
  'GRAY',
  'BLUE',
  'GREEN',
  'YELLOW',
  'ORANGE',
  'RED',
  'PINK',
  'PURPLE'
] as const

const httpUrl = z
  .string()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), { message: 'must be an http(s) URL' })
const httpsUrl = z
  .string()
  .max(2048)
  .refine((value) => /^https:\/\//i.test(value), { message: 'must be an https URL' })

const optionSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  color: z.enum(GITHUB_COLORS).optional(),
  description: z.string().max(500).optional(),
  category: z.enum(['todo', 'in-progress', 'done']).optional()
})

const iterationSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.number().int().positive().max(366)
})

const fieldSchema = z.discriminatedUnion('type', [
  z.object({ name: z.string().min(1).max(100), type: z.literal('text') }),
  z.object({ name: z.string().min(1).max(100), type: z.literal('number') }),
  z.object({ name: z.string().min(1).max(100), type: z.literal('date') }),
  z.object({
    name: z.string().min(1).max(100),
    type: z.literal('single-select'),
    options: z.array(optionSchema).min(1).max(50)
  }),
  z.object({
    name: z.string().min(1).max(100),
    type: z.literal('iteration'),
    iterations: z.array(iterationSchema).max(50)
  })
])

const sourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,64}$/, { message: 'must be a slug [a-z0-9-]{1,64}' }),
  name: z.string().min(1).max(100),
  logoUrl: httpsUrl.optional(),
  url: httpUrl.optional(),
  taskIdPattern: z.string().max(200).optional(),
  fields: z.array(fieldSchema).max(50)
})

const capabilitiesSchema = z.object({
  actionsUrl: httpUrl,
  actions: z.array(z.string().max(50)).max(20)
})

const documentSchema = z.object({
  schema: z.literal(ZOTZ_TASKS_SCHEMA),
  source: sourceSchema,
  capabilities: capabilitiesSchema.optional(),
  tasks: z.array(z.unknown()).max(ZOTZ_TASKS_MAX_TASKS)
})

const personSchema = z.object({
  login: z.string().min(1).max(100),
  name: z.string().max(200).optional(),
  avatarUrl: httpsUrl.optional()
})

const taskSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(['issue', 'draft']).default('issue'),
  title: z.string().min(1).max(300),
  state: z.enum(['open', 'closed']),
  project: z
    .object({
      id: z.string().min(1).max(100),
      name: z.string().min(1).max(100),
      avatarUrl: httpsUrl.optional()
    })
    .optional(),
  url: httpUrl.optional(),
  assignees: z.array(personSchema).max(20).default([]),
  labels: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        color: z
          .string()
          .regex(/^#?[0-9a-fA-F]{6}$/)
          .optional()
      })
    )
    .max(30)
    .default([]),
  body: z
    .string()
    .max(64 * 1024)
    .optional(),
  fieldValues: z.record(
    z.string(),
    z.union([z.string().max(1000), z.number(), z.boolean(), z.null()])
  ),
  pullRequests: z
    .array(
      z.object({
        repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
        number: z.number().int().positive()
      })
    )
    .max(50)
    .default([]),
  createdAt: z.string().max(64).optional(),
  updatedAt: z.string().max(64).optional()
})

export type ZotzTasksSource = z.infer<typeof sourceSchema>
export type ZotzTasksField = z.infer<typeof fieldSchema>
export type ZotzTasksStatusOption = z.infer<typeof optionSchema>
export type ZotzExternalTask = z.infer<typeof taskSchema>
export type ZotzTasksDocument = {
  schema: typeof ZOTZ_TASKS_SCHEMA
  source: ZotzTasksSource
  capabilities?: z.infer<typeof capabilitiesSchema>
  tasks: ZotzExternalTask[]
}

export type ZotzTasksRejectedTask = { index: number; id: string | null; reason: string }

export type ZotzTasksParseResult =
  | { ok: true; document: ZotzTasksDocument; rejected: ZotzTasksRejectedTask[] }
  | { ok: false; error: string }

export type ZotzTasksFormat = 'json' | 'yaml' | 'toml'

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')
}

export function zotzTasksStatusField(
  source: ZotzTasksSource
): Extract<ZotzTasksField, { type: 'single-select' }> | null {
  const field = source.fields.find((item) => item.name === 'Status')
  return field?.type === 'single-select' ? field : null
}

/** Checks each value against its declared field; a value for an unknown field is an error too. */
function fieldValueError(
  source: ZotzTasksSource,
  fieldValues: ZotzExternalTask['fieldValues']
): string | null {
  const fields = new Map(source.fields.map((field) => [field.name, field]))
  for (const [name, value] of Object.entries(fieldValues)) {
    const field = fields.get(name)
    if (!field) {
      return `fieldValues.${name}: no field with that name in source.fields`
    }
    if (value === null) {
      continue
    }
    const fits =
      field.type === 'text'
        ? typeof value === 'string'
        : field.type === 'number'
          ? typeof value === 'number'
          : field.type === 'date'
            ? typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
            : field.type === 'single-select'
              ? field.options.some((option) => option.id === value)
              : field.iterations.some((iteration) => iteration.id === value)
    if (!fits) {
      return `fieldValues.${name}: not a valid ${field.type} value`
    }
  }
  return null
}

function decode(text: string, format: ZotzTasksFormat | 'auto'): unknown {
  if (format === 'json') {
    return JSON.parse(text)
  }
  if (format === 'yaml') {
    return parseYaml(text)
  }
  if (format === 'toml') {
    return parseToml(text)
  }
  const trimmed = text.trimStart()
  if (trimmed.startsWith('{')) {
    return JSON.parse(text)
  }
  // TOML documents open with a key = value line; YAML (a JSON superset) takes everything else.
  return /^[A-Za-z0-9_"-]+\s*=/.test(trimmed) ? parseToml(text) : parseYaml(text)
}

/** Validates a whole feed. A bad task is dropped and reported; a bad envelope rejects the feed. */
export function parseZotzTasks(
  text: string,
  format: ZotzTasksFormat | 'auto' = 'auto'
): ZotzTasksParseResult {
  if (new TextEncoder().encode(text).length > ZOTZ_TASKS_MAX_BYTES) {
    return { ok: false, error: `Document is larger than ${ZOTZ_TASKS_MAX_BYTES / 1024 / 1024} MB` }
  }
  let raw: unknown
  try {
    raw = decode(text, format)
  } catch (error) {
    return {
      ok: false,
      error: `Could not read the document: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  const envelope = documentSchema.safeParse(raw)
  if (!envelope.success) {
    return { ok: false, error: describeIssues(envelope.error) }
  }
  const { source } = envelope.data
  if (!zotzTasksStatusField(source)) {
    return { ok: false, error: 'source.fields needs a single-select field named "Status"' }
  }
  const tasks: ZotzExternalTask[] = []
  const rejected: ZotzTasksRejectedTask[] = []
  const seen = new Set<string>()
  envelope.data.tasks.forEach((candidate, index) => {
    const parsed = taskSchema.safeParse(candidate)
    const id =
      typeof candidate === 'object' &&
      candidate !== null &&
      'id' in candidate &&
      typeof candidate.id === 'string'
        ? candidate.id
        : null
    if (!parsed.success) {
      rejected.push({ index, id, reason: describeIssues(parsed.error) })
      return
    }
    const task = parsed.data
    const reason = seen.has(task.id)
      ? 'duplicate id'
      : task.fieldValues.Status === undefined || task.fieldValues.Status === null
        ? 'fieldValues.Status is required'
        : fieldValueError(source, task.fieldValues)
    if (reason) {
      rejected.push({ index, id: task.id, reason })
      return
    }
    seen.add(task.id)
    tasks.push(task)
  })
  return {
    ok: true,
    document: { ...envelope.data, schema: ZOTZ_TASKS_SCHEMA, source, tasks },
    rejected
  }
}

/** The contract as JSON Schema, for services that validate before they publish. */
export function zotzTasksJsonSchema(): unknown {
  return z.toJSONSchema(
    documentSchema.extend({ tasks: z.array(taskSchema).max(ZOTZ_TASKS_MAX_TASKS) }),
    { unrepresentable: 'any' }
  )
}

/** Format from a file name or URL path; anything else is detected from the content. */
export function zotzTasksFormatFromName(name: string): ZotzTasksFormat | 'auto' {
  const lower = name.toLowerCase()
  if (lower.endsWith('.json')) {
    return 'json'
  }
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return 'yaml'
  }
  return lower.endsWith('.toml') ? 'toml' : 'auto'
}
