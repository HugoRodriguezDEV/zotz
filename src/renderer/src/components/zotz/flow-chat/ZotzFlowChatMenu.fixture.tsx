import { ZotzFlowSchema } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import { zotzFlowChatEntries } from '../../../../../shared/zotz/flows/zotz-flow-chat-command'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzFlowChatMenu } from './ZotzFlowChatMenu'
import { ZotzFlowChatInputsDialog } from './ZotzFlowChatInputsDialog'

function chatFlow(slug: string, name: string, description: string, inputs: unknown[] = []) {
  return ZotzFlowSchema.parse({
    id: `id-${slug}`,
    name,
    slug,
    description,
    hostId: 'local',
    triggers: [{ id: `t-${slug}`, kind: 'chat_command', command: slug, inputs }],
    nodes: [],
    edges: [],
    createdAt: 1,
    updatedAt: 1
  })
}

const server = { hostId: 'runtime:msi', environmentId: 'msi' }
const local = { hostId: 'local', environmentId: null }

const release = chatFlow(
  'publicar',
  'Publicar versión',
  'Corre las pruebas y prepara la versión.',
  [
    {
      name: 'canal',
      label: 'Canal',
      type: 'select',
      options: ['estable', 'beta'],
      default: 'beta'
    },
    { name: 'version', label: 'Versión', type: 'text', required: true },
    { name: 'notificar', label: 'Avisar al terminar', type: 'boolean', default: true }
  ]
)

const groups = [
  {
    hostId: server.hostId,
    label: 'MSI',
    entries: zotzFlowChatEntries(server, [
      chatFlow('revisar-pr', 'Revisar PR', 'Claude revisa el PR y Codex aplica los cambios.'),
      release
    ])
  },
  {
    hostId: local.hostId,
    label: 'Esta máquina',
    entries: zotzFlowChatEntries(local, [
      chatFlow('resumir', 'Resumir conversación', 'Deja un resumen como nota en el chat.')
    ])
  }
]

export const grouped = defineFixture({
  width: 760,
  render: () => (
    <ZotzFlowChatMenu open groups={groups} loading={false} onChoose={() => {}} onClose={() => {}} />
  )
})

export const inputs = defineFixture({
  width: 760,
  render: () => (
    <ZotzFlowChatInputsDialog
      flowName={release.name}
      description={release.description}
      fields={zotzFlowChatEntries(server, [release])[0].trigger.inputs}
      initialText="incluye el changelog"
      running={false}
      error={null}
      onRun={() => {}}
      onClose={() => {}}
    />
  )
})
