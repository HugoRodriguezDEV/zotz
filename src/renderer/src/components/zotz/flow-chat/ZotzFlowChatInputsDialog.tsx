import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type {
  ZotzFlowInputField,
  ZotzFlowInputValues
} from '../../../../../shared/zotz/flows/zotz-flow-trigger-contract'

type Values = Record<string, string | boolean>

function initialValues(fields: readonly ZotzFlowInputField[]): Values {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      field.type === 'boolean' ? (field.default ?? false) : String(field.default ?? '')
    ])
  )
}

/** Empty optional fields stay out, so the flow's own defaults apply. */
function submittedValues(
  fields: readonly ZotzFlowInputField[],
  values: Values
): ZotzFlowInputValues {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = values[field.name]
      return value === '' || value === undefined ? [] : [[field.name, value]]
    })
  )
}

function FieldControl({
  field,
  id,
  value,
  invalid,
  onChange
}: {
  field: ZotzFlowInputField
  id: string
  value: string | boolean
  invalid: boolean
  onChange: (value: string | boolean) => void
}): React.JSX.Element {
  switch (field.type) {
    case 'boolean':
      return (
        <Checkbox
          id={id}
          checked={value === true}
          onCheckedChange={(next) => onChange(next === true)}
        />
      )
    case 'select':
      return (
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger id={id} aria-invalid={invalid} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case 'number':
    case 'text':
      return (
        <Input
          id={id}
          type={field.type === 'number' ? 'number' : 'text'}
          value={String(value)}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      )
  }
}

/** A short form before a chat command runs a flow whose trigger asks for inputs (spec §6.1). */
export function ZotzFlowChatInputsDialog({
  flowName,
  description,
  fields,
  initialText,
  running,
  error,
  onRun,
  onClose
}: {
  flowName: string
  description: string
  fields: readonly ZotzFlowInputField[]
  initialText: string
  running: boolean
  error: string | null
  onRun: (text: string, inputs: ZotzFlowInputValues) => void
  onClose: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const [text, setText] = useState(initialText)
  const [values, setValues] = useState(() => initialValues(fields))
  const [tried, setTried] = useState(false)
  const missing = fields.filter(
    (field) => field.required && field.type !== 'boolean' && values[field.name] === ''
  )
  const submit = (): void => {
    setTried(true)
    if (missing.length === 0 && !running) {
      onRun(text.trim(), submittedValues(fields, values))
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
    >
      <DialogContent surface="security" scrollable>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t('zotz.flowChat.formTitle', 'Run {{flow}}', { flow: flowName })}
            </DialogTitle>
            <DialogDescription>
              {description ||
                t('zotz.flowChat.formDescription', 'This flow asks for a few values first.')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="zotz-flow-chat-text">{t('zotz.flowChat.formText', 'Text')}</Label>
            <Textarea
              id="zotz-flow-chat-text"
              value={text}
              rows={2}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          {fields.map((field) => {
            const id = `zotz-flow-chat-input-${field.name}`
            const invalid = tried && missing.includes(field)
            const label = field.label ?? field.name
            return field.type === 'boolean' ? (
              <div key={field.name} className="flex items-center gap-2">
                <FieldControl
                  field={field}
                  id={id}
                  value={values[field.name]}
                  invalid={false}
                  onChange={(value) =>
                    setValues((current) => ({ ...current, [field.name]: value }))
                  }
                />
                <Label htmlFor={id}>{label}</Label>
              </div>
            ) : (
              <div key={field.name} className="grid gap-2">
                <Label htmlFor={id}>
                  {field.required
                    ? t('zotz.flowChat.formRequired', '{{label}} (required)', { label })
                    : label}
                </Label>
                <FieldControl
                  field={field}
                  id={id}
                  value={values[field.name]}
                  invalid={invalid}
                  onChange={(value) =>
                    setValues((current) => ({ ...current, [field.name]: value }))
                  }
                />
                {invalid ? (
                  <p className="text-sm text-destructive">
                    {t('zotz.flowChat.formMissing', 'Fill this in to run the flow.')}
                  </p>
                ) : null}
              </div>
            )
          })}
          {error ? <p className="text-sm break-words text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('zotz.flowChat.formCancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={running}>
              {running ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              ) : null}
              {t('zotz.flowChat.formRun', 'Run flow')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
