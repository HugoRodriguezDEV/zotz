import { useAppStore } from '@/store/index'
import { defineFixture, type ComponentFixture } from '../../../component-fixtures/component-fixture'
import type { Repo } from '../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import type {
  ZotzConversationEntry,
  ZotzLinkMessage
} from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import ZotzLinksPanel from './ZotzLinksPanel'

const api: Repo = {
  id: 'api',
  path: '/code/api',
  displayName: 'api-pagos',
  badgeColor: '',
  addedAt: 1
}

function worktree(branch: string, displayName: string): Worktree {
  return {
    id: `api::${branch}`,
    displayName,
    repoId: 'api',
    path: `/code/api/${branch}`,
    branch: `refs/heads/${branch}`,
    head: 'abc1234',
    isBare: false,
    isMainWorktree: false,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 1
  }
}

const sprint = worktree('salmon', 'Repartir el sprint')
const pagination = worktree('albatross', 'Paginar el endpoint de pacientes')
const csv = worktree('heron', 'Exportar reportes a CSV')

const entry = (
  w: Worktree,
  shortName: string,
  agent: string,
  state: ZotzConversationEntry['state']
): ZotzConversationEntry => ({
  worktreeId: w.id,
  path: w.path,
  shortName,
  title: w.displayName,
  projectName: 'api-pagos',
  agent,
  state,
  address: `orca_session_id:${shortName}`
})

const OTHERS: [string, string, string, ZotzConversationEntry['state']][] = [
  ['marlin', 'Migrar sesiones a Redis', 'claude', 'working'],
  ['puffin', 'Revisar permisos del bucket', 'codex', 'waiting'],
  ['otter', 'Arreglar el login con Google', 'claude', 'working'],
  ['gecko', 'Limpiar dependencias viejas', 'codex', 'idle'],
  ['lynx', 'Documentar la API de citas', 'claude', 'done'],
  ['wren', 'Bajar el tiempo del build', 'claude', 'idle'],
  ['koala', 'Reintentos en webhooks de pago', 'codex', 'done'],
  ['ibis', 'Notificaciones por correo', 'claude', 'idle'],
  ['tapir', 'Ajustar zona horaria en reportes', 'claude', 'done']
]

const CONVERSATIONS = [
  entry(sprint, 'salmon', 'claude', 'waiting'),
  entry(pagination, 'albatross', 'codex', 'working'),
  entry(csv, 'heron', 'claude', 'done'),
  ...OTHERS.map(([branch, title, agent, state]) =>
    entry(worktree(branch, title), branch, agent, state)
  )
]

const now = Date.now()
const MESSAGES: ZotzLinkMessage[] = [
  {
    id: 'm1',
    from: 'orca_session_id:salmon',
    to: 'orca_session_id:albatross',
    fromLabel: null,
    subject: 'Paginación',
    body: 'Usa cursor en lugar de offset; el front ya lo espera así.',
    type: 'status',
    createdAt: now - 12 * 60_000
  },
  {
    id: 'm2',
    from: 'orca_session_id:albatross',
    to: 'orca_session_id:salmon',
    fromLabel: null,
    subject: 'Re: Paginación',
    body: 'Listo, endpoint con cursor. Falta el test de la última página.',
    type: 'status',
    createdAt: now - 3 * 60_000
  }
]

const linkedGroupSetup: Pick<ComponentFixture, 'store' | 'setup'> = {
  store: {
    repos: [api],
    worktreesByRepo: { api: [sprint, pagination, csv] },
    activeWorktreeId: sprint.id
  },
  setup: () => {
    Object.assign(window.api.runtime, {
      call: async ({ method }: { method: string }) => ({
        ok: true,
        id: 'fixture',
        result:
          method === 'zotz.conversations.list'
            ? { conversations: CONVERSATIONS }
            : method === 'zotz.links.messages'
              ? { messages: MESSAGES }
              : { ok: true }
      })
    })
    useAppStore.setState((state) => ({
      settings: state.settings && {
        ...state.settings,
        zotzConversationLinks: [
          {
            id: 'g1',
            createdAt: 1,
            members: [
              { hostId: 'local', path: sprint.path },
              { hostId: 'local', path: pagination.path }
            ]
          }
        ]
      }
    }))
  }
}

/** While the group works, each machine folds into one summary row. */
export const linkedGroup = defineFixture({
  width: 340,
  ...linkedGroupSetup,
  render: () => (
    <div className="flex h-[640px] flex-col bg-sidebar">
      <ZotzLinksPanel />
    </div>
  )
})

/** The user opened the folded machine: its full list shows as before. */
export const linkedGroupMachineOpen = defineFixture({
  width: 340,
  ...linkedGroupSetup,
  interact: (frame) => {
    frame.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click()
  },
  render: () => (
    <div className="flex h-[1100px] flex-col bg-sidebar">
      <ZotzLinksPanel />
    </div>
  )
})
