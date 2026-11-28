import { z, type ZodType } from 'zod'
import type {
  ZotzFlowJsonField,
  ZotzFlowOutputFormat
} from '../../../shared/zotz/flows/zotz-flow-node-contract'

type JsonFormat = Extract<ZotzFlowOutputFormat, { mode: 'json' }>

export type ZotzFlowJsonCheck = { ok: true; value: unknown } | { ok: false; error: string }

const FENCED_BLOCK = /```[ \t]*json[^\n]*\n([\s\S]*?)```/gi

/** The last ```json block of an agent reply (spec §4.4). */
export function extractLastZotzFlowJsonBlock(text: string): string | null {
  let last: string | null = null
  for (const match of text.matchAll(FENCED_BLOCK)) {
    last = match[1] ?? null
  }
  return last
}

function fieldSchema(field: ZotzFlowJsonField): ZodType {
  switch (field.type) {
    case 'string':
      return z.string()
    case 'number':
      return z.number()
    case 'integer':
      return z.number().int()
    case 'boolean':
      return z.boolean()
    case 'array':
      return z.array(z.unknown())
    case 'object':
      return z.record(z.string(), z.unknown())
  }
}

function formatSchema(format: JsonFormat): ZodType {
  if ('fields' in format) {
    return z.looseObject(
      Object.fromEntries(
        format.fields.map((field) => [
          field.name,
          field.required ? fieldSchema(field) : fieldSchema(field).nullish()
        ])
      )
    )
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a JSON object; fromJSONSchema throws on what it cannot read and the caller reports it.
  return z.fromJSONSchema(format.schema as Parameters<typeof z.fromJSONSchema>[0])
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`)
    .join('; ')
}

export function checkZotzFlowJson(value: unknown, format: JsonFormat): ZotzFlowJsonCheck {
  let schema: ZodType
  try {
    schema = formatSchema(format)
  } catch (error) {
    return {
      ok: false,
      error: `The JSON Schema cannot be used: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  const parsed = schema.safeParse(value)
  return parsed.success
    ? { ok: true, value: parsed.data }
    : {
        ok: false,
        error: `The JSON does not match the expected fields: ${describeIssues(parsed.error)}`
      }
}

export function parseZotzFlowJsonText(text: string, format: JsonFormat): ZotzFlowJsonCheck {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      error: `The output is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  return checkZotzFlowJson(value, format)
}

/** Agent replies end with a fenced block; command stdout and HTTP bodies are the JSON itself. */
export function readZotzFlowAgentJson(reply: string, format: JsonFormat): ZotzFlowJsonCheck {
  const block = extractLastZotzFlowJsonBlock(reply)
  if (block === null) {
    return { ok: false, error: 'The reply does not end with a ```json block.' }
  }
  return parseZotzFlowJsonText(block, format)
}

function describeExpectedShape(format: JsonFormat): string {
  if ('fields' in format) {
    return format.fields
      .map(
        (field) =>
          `- "${field.name}" (${field.type}${field.required ? ', required' : ', optional'})${
            field.description ? `: ${field.description}` : ''
          }`
      )
      .join('\n')
  }
  return `JSON Schema:\n${JSON.stringify(format.schema, null, 2)}`
}

/** Appended to an agent prompt whose output format is JSON. */
export function zotzFlowJsonInstruction(format: JsonFormat): string {
  return [
    '',
    '---',
    'End your reply with a single fenced ```json code block holding one JSON object with these fields:',
    describeExpectedShape(format),
    'The last ```json block of your reply is read as the result of this step.'
  ].join('\n')
}

/** The one correction asked in the same session when the first JSON fails (spec §4.4). */
export function zotzFlowJsonCorrectionPrompt(format: JsonFormat, error: string): string {
  return [
    `Your previous reply could not be used as the result of this step: ${error}`,
    'Reply again ending with one fenced ```json code block holding one JSON object with these fields:',
    describeExpectedShape(format)
  ].join('\n')
}
