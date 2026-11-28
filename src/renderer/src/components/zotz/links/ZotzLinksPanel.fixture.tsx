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
  ['gecko', 'Limpiar dependencias viejas', 'antigravity', 'idle'],
  ['lynx', 'Documentar la API de citas', 'claude', 'done'],
  ['wren', 'Bajar el tiempo del build', 'claude', 'idle'],
  ['koala', 'Reintentos en webhooks de pago', 'antigravity', 'done'],
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

async function robotButton(frame: HTMLElement, name: string): Promise<HTMLButtonElement | null> {
  for (let tries = 0; tries < 50; tries++) {
    const button = [...frame.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(
      (candidate) => candidate.getAttribute('aria-label')?.startsWith(name)
    )
    if (button) {
      return button
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return null
}

/** While the group works, each machine folds into one summary row. */
export const linkedGroup = defineFixture({
  width: 340,
  ...linkedGroupSetup,
  render: () => (
    <div className="flex h-[880px] flex-col bg-sidebar">
      <ZotzLinksPanel />
    </div>
  )
})

/** The user opened the folded machine: its conversations show as a room of robots. */
export const linkedGroupMachineOpen = defineFixture({
  width: 340,
  ...linkedGroupSetup,
  interact: async (frame) => {
    const fold = frame.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')
    fold?.click()
    await robotButton(frame, 'tapir')
    fold?.scrollIntoView({ block: 'start' })
  },
  render: () => (
    <div className="flex h-[880px] flex-col bg-sidebar">
      <ZotzLinksPanel />
    </div>
  )
})

/** A robot picked in the machine's room: its card below offers Link. */
export const machineRobotPicked = defineFixture({
  width: 340,
  ...linkedGroupSetup,
  interact: async (frame) => {
    frame.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click()
    ;(await robotButton(frame, 'puffin'))?.click()
    await new Promise((resolve) => setTimeout(resolve, 50))
    frame.querySelector('[aria-live="polite"]')?.scrollIntoView({ block: 'end' })
  },
  render: () => (
    <div className="flex h-[880px] flex-col bg-sidebar">
      <ZotzLinksPanel />
    </div>
  )
})

const otter = worktree('otter', 'Arreglar el login con Google')
const marlin = worktree('marlin', 'Migrar sesiones a Redis')

function serve(
  conversations: ZotzConversationEntry[],
  messages: ZotzLinkMessage[],
  links: { id: string; createdAt: number; members: { hostId: 'local'; path: string }[] }[]
): () => void {
  return () => {
    Object.assign(window.api.runtime, {
      call: async ({ method }: { method: string }) => ({
        ok: true,
        id: 'fixture',
        result:
          method === 'zotz.conversations.list'
            ? { conversations }
            : method === 'zotz.links.messages'
              ? { messages }
              : { ok: true }
      })
    })
    useAppStore.setState((state) => ({
      settings: state.settings && { ...state.settings, zotzConversationLinks: links }
    }))
  }
}

const mail = (
  id: string,
  from: string,
  to: string,
  type: string,
  subject: string,
  body: string,
  minutesAgo: number
): ZotzLinkMessage => ({
  id,
  from: `orca_session_id:${from}`,
  to: `orca_session_id:${to}`,
  fromLabel: null,
  subject,
  body,
  type,
  createdAt: now - minutesAgo * 60_000
})

const childOf = (child: ZotzConversationEntry, parent: Worktree): ZotzConversationEntry => ({
  ...child,
  parentWorktreeId: parent.id
})

/** A conversation that started two workers (one started its own), in no group. */
export const parentWithWorkers = defineFixture({
  width: 340,
  store: {
    repos: [api],
    worktreesByRepo: { api: [sprint, pagination, csv, marlin] },
    activeWorktreeId: sprint.id
  },
  setup: serve(
    CONVERSATIONS.map((conversation) =>
      conversation.path === pagination.path || conversation.path === csv.path
        ? childOf(conversation, sprint)
        : conversation.path === marlin.path
          ? childOf(conversation, csv)
          : conversation
    ),
    [
      mail('b1', 'salmon', 'albatross', 'dispatch', 'Paginar pacientes', 'Usa cursor.', 20),
      mail('b2', 'salmon', 'heron', 'dispatch', 'Exportar a CSV', 'Columnas del reporte.', 19),
      mail('b3', 'heron', 'marlin', 'dispatch', 'Sesiones en Redis', 'Para el export.', 15),
      mail('q1', 'albatross', 'salmon', 'question', 'Question', '¿Cursor u offset?', 10),
      mail('r1', 'salmon', 'albatross', 'status', 'Re: Question', 'Cursor.', 9),
      mail('d1', 'heron', 'salmon', 'worker_done', 'CSV listo', 'PR abierto.', 2)
    ],
    []
  ),
  render: () => (
    <div className="flex h-[1100px] flex-col bg-sidebar">
      <ZotzLinksPanel />
    </div>
  )
})

/** A group of two; one member started a worker that is not in the group. */
export const groupWithWorker = defineFixture({
  width: 340,
  store: {
    repos: [api],
    worktreesByRepo: { api: [sprint, pagination, csv, otter] },
    activeWorktreeId: sprint.id
  },
  setup: serve(
    CONVERSATIONS.map((conversation) =>
      conversation.path === otter.path ? childOf(conversation, pagination) : conversation
    ),
    [
      ...MESSAGES,
      mail('b1', 'albatross', 'otter', 'dispatch', 'Login con Google', 'Revisa el callback.', 8),
      mail('d1', 'otter', 'albatross', 'worker_done', 'Login listo', 'Faltaba el scope.', 1)
    ],
    [
      {
        id: 'g1',
        createdAt: 1,
        members: [
          { hostId: 'local', path: sprint.path },
          { hostId: 'local', path: pagination.path }
        ]
      }
    ]
  ),
  render: () => (
    <div className="flex h-[1000px] flex-col bg-sidebar">
      <ZotzLinksPanel />
    </div>
  )
})

/** The same family with the machine open: its room joins each worker to its parent too. */
export const parentWithWorkersMachineOpen = defineFixture({
  ...parentWithWorkers,
  interact: async (frame) => {
    const fold = frame.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')
    fold?.click()
    await robotButton(frame, 'tapir')
    await new Promise((resolve) => setTimeout(resolve, 300))
    fold?.scrollIntoView({ block: 'start' })
  }
})
