import { defineFixture } from '../../../component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../../shared/constants'
import type { Repo } from '../../../../../shared/repository/repo-types'
import ZotzProjectSidebar from './ZotzProjectSidebar'
import { ZotzConversationRow } from './ZotzConversationRow'
import {
  msiRuntime,
  repo,
  rodri,
  stubEmptyZotzAgentQueue,
  worktree
} from './zotz-project-sidebar-fixture-models'

const zotz = repo('zotz', 'zotz')
const panel = repo('panel', 'avena.io-panel')
const backend = repo('backend', 'backend')

export const projects = defineFixture({
  width: 300,
  store: {
    repos: [zotz, panel, backend],
    worktreesByRepo: {
      zotz: [
        worktree('zotz', 'main', 'main', { isMainWorktree: true }),
        worktree('zotz', 'isai-avena/zotz-mejorar-vistas', 'Mejorar vistas', { lastActivityAt: 3 }),
        worktree('zotz', 'zotz/fase-1b-sin-orca', 'Desconectar servidores de Orca', {
          lastActivityAt: 2
        }),
        worktree('zotz', 'cli-made', 'Created by the CLI', {
          cliProvenance: { kind: 'created-by-cli', createdAt: 1 }
        })
      ],
      panel: [
        worktree('panel', 'master', 'master', { isMainWorktree: true }),
        worktree('panel', 'op-142-fix-login', 'OP-142 login con Google')
      ],
      backend: [worktree('backend', 'main', 'main', { isMainWorktree: true })]
    },
    activeWorktreeId: 'zotz::isai-avena/zotz-mejorar-vistas'
  },
  render: () => (
    <div className="flex h-[520px] flex-col bg-worktree-sidebar">
      <ZotzProjectSidebar />
    </div>
  )
})

export const archivedMain = defineFixture({
  width: 300,
  setup: stubEmptyZotzAgentQueue,
  store: {
    repos: [rodri],
    runtimeEnvironments: [msiRuntime],
    worktreesByRepo: {
      rodri: [
        worktree('rodri', 'main', 'rodri', { isMainWorktree: true, isArchived: true }),
        worktree('rodri', 'feature', 'tarpon', { isArchived: true }),
        worktree('rodri', 'wip', 'Conversación activa')
      ]
    }
  },
  interact: async (frame) => {
    const toggle = [...frame.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Archived')
    )
    toggle?.click()
  },
  render: () => (
    <div className="flex h-[300px] flex-col bg-worktree-sidebar">
      <ZotzProjectSidebar />
    </div>
  )
})

const queuedWorktree = worktree('zotz', 'memory-limiter', 'Indicador de la cola')

export const queuedConversation = defineFixture({
  width: 300,
  store: { repos: [zotz], worktreesByRepo: { zotz: [queuedWorktree] } },
  render: () => (
    <div className="bg-worktree-sidebar p-2">
      <ZotzConversationRow
        row={{
          id: queuedWorktree.id,
          worktree: queuedWorktree,
          title: 'Indicador de la cola',
          branch: 'memory-limiter',
          shortName: 'memory-limiter',
          lastActivityAt: 1,
          repo: zotz,
          hostId: 'local'
        }}
        repo={zotz}
        active={false}
        status={{ state: 'working', unread: false, agentType: 'claude' }}
        canceled={false}
        queuedSince={Date.now() - 20 * 60_000}
      />
    </div>
  )
})

// The agent's turn is over and only its commands and monitors run: the radar keeps watch.
export const onlyProcessesLeft = defineFixture({
  width: 300,
  store: { repos: [zotz], worktreesByRepo: { zotz: [queuedWorktree] } },
  render: () => (
    <div className="bg-worktree-sidebar p-2">
      <ZotzConversationRow
        row={{
          id: queuedWorktree.id,
          worktree: queuedWorktree,
          title: 'Servidor de pruebas corriendo',
          branch: 'memory-limiter',
          shortName: 'memory-limiter',
          lastActivityAt: 1,
          repo: zotz,
          hostId: 'local'
        }}
        repo={zotz}
        active={false}
        status={{ state: 'monitoring', unread: false, agentType: 'claude' }}
        canceled={false}
        queuedSince={null}
      />
    </div>
  )
})

const salmonWorktree = {
  ...worktree('zotz', 'zotz/fase-9-tareas', 'Chat workspace board options'),
  path: '/code/zotz/salmon'
}

export const shortName = defineFixture({
  width: 300,
  store: { repos: [zotz], worktreesByRepo: { zotz: [salmonWorktree] } },
  render: () => (
    <div className="bg-worktree-sidebar p-2">
      <ZotzConversationRow
        row={{
          id: salmonWorktree.id,
          worktree: salmonWorktree,
          title: 'Chat workspace board options',
          branch: 'zotz/fase-9-tareas',
          shortName: 'salmon',
          lastActivityAt: 1,
          repo: zotz,
          hostId: 'local'
        }}
        repo={zotz}
        active={false}
        status={null}
        canceled={false}
        queuedSince={null}
      />
    </div>
  )
})

// The same GitHub repo on this Mac and on the MSI: one project, each conversation names its machine.
// Icons already set, so the GitHub avatar lookup leaves them alone.
const zotzOnGitHub: Repo = { ...zotz, repoIcon: { type: 'emoji', emoji: '🦇' } }
const empresas: Repo = {
  ...repo('empresas', 'avena-empresas'),
  repoIcon: { type: 'emoji', emoji: '🧾' }
}
const GITHUB_SLUGS: Record<string, { owner: string; repo: string }> = {
  zotz: { owner: 'HugoRodriguezDEV', repo: 'zotz' },
  empresas: { owner: 'Avena-Health', repo: 'avena-backoffice' }
}

export const githubRepoInGroup = defineFixture({
  width: 300,
  setup: () => {
    Object.assign(window.api, {
      gh: {
        ...window.api.gh,
        repoSlug: async ({ repoId }: { repoId?: string }) => GITHUB_SLUGS[repoId ?? ''] ?? null
      }
    })
  },
  store: {
    repos: [zotzOnGitHub, empresas],
    worktreesByRepo: {
      zotz: [
        worktree('zotz', 'repo-visible', 'Mostrar el repo de GitHub', {
          lastActivityAt: Date.now() - 5 * 60_000
        })
      ],
      empresas: [
        worktree('empresas', 'op-200-facturas', 'OP-200 facturas', {
          lastActivityAt: Date.now() - 3 * 60 * 60_000
        })
      ]
    },
    settings: {
      ...getDefaultSettings('/home/fixture'),
      zotzConversationLinks: [
        {
          id: 'g1',
          name: 'Facturación',
          createdAt: 1,
          members: [
            { hostId: 'local', path: '/code/zotz/repo-visible' },
            { hostId: 'local', path: '/code/empresas/op-200-facturas' }
          ]
        }
      ]
    }
  },
  render: () => (
    <div className="flex h-[380px] flex-col bg-worktree-sidebar">
      <ZotzProjectSidebar />
    </div>
  )
})

// Long group, project and branch names must truncate beside the pixel icons, not push them out.
const longProject = repo('long', 'avena-health-backoffice-empresas-admin')
export const longNames = defineFixture({
  width: 300,
  store: {
    repos: [longProject],
    worktreesByRepo: {
      long: [
        worktree(
          'long',
          'isai/op-318-exportar-facturas-por-empresa',
          'Exportar facturas por empresa y periodo fiscal',
          { lastActivityAt: Date.now() - 2 * 60_000 }
        ),
        worktree('long', 'op-142-fix-login', 'OP-142 login con Google', {
          lastActivityAt: Date.now() - 60 * 60_000
        })
      ]
    },
    activeWorktreeId: 'long::isai/op-318-exportar-facturas-por-empresa',
    settings: {
      ...getDefaultSettings('/home/fixture'),
      zotzConversationLinks: [
        {
          id: 'g-long',
          name: 'Facturación electrónica multiempresa',
          createdAt: 1,
          members: [{ hostId: 'local', path: '/code/long/op-142-fix-login' }]
        }
      ]
    }
  },
  render: () => (
    <div className="flex h-[300px] flex-col bg-worktree-sidebar">
      <ZotzProjectSidebar />
    </div>
  )
})
