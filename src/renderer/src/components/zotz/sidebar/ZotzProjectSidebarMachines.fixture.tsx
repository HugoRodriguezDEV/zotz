import { defineFixture } from '../../../component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../../shared/constants'
import type { Repo } from '../../../../../shared/repository/repo-types'
import ZotzProjectSidebar from './ZotzProjectSidebar'
import {
  msiRuntime,
  repo,
  rodri,
  stubEmptyZotzAgentQueue,
  worktree
} from './zotz-project-sidebar-fixture-models'

const zotz = repo('zotz', 'zotz')

const uni: Repo = { ...repo('uni', 'uni'), executionHostId: 'runtime:msi' }

export const remoteProjects = defineFixture({
  width: 300,
  setup: stubEmptyZotzAgentQueue,
  store: {
    repos: [zotz, rodri, uni],
    runtimeEnvironments: [msiRuntime],
    worktreesByRepo: {
      zotz: [worktree('zotz', 'main', 'main', { isMainWorktree: true })],
      rodri: [worktree('rodri', 'main', 'rodri', { isMainWorktree: true })],
      uni: [worktree('uni', 'main', 'uni', { isMainWorktree: true })]
    }
  },
  render: () => (
    <div className="flex h-[260px] flex-col bg-worktree-sidebar">
      <ZotzProjectSidebar />
    </div>
  )
})

const apiUpstream = { owner: 'acme', repo: 'api-pagos' }
const apiLocal: Repo = { ...repo('api-local', 'api-pagos'), upstream: apiUpstream }
const apiMsi: Repo = {
  ...repo('api-msi', 'api-pagos'),
  upstream: apiUpstream,
  executionHostId: 'runtime:msi'
}

export const projectAcrossMachines = defineFixture({
  width: 300,
  setup: stubEmptyZotzAgentQueue,
  store: {
    repos: [apiLocal, apiMsi],
    runtimeEnvironments: [{ ...msiRuntime, name: 'MSI Server' }],
    worktreesByRepo: {
      'api-local': [
        worktree('api-local', 'repartir-sprint', 'Repartir el sprint', { lastActivityAt: 4 })
      ],
      'api-msi': [
        worktree('api-msi', 'paginar-pacientes', 'Paginar el endpoint de pacientes', {
          lastActivityAt: 3
        }),
        worktree('api-msi', 'exportar-csv', 'Exportar reportes a CSV', { lastActivityAt: 2 })
      ]
    }
  },
  render: () => (
    <div className="flex h-[260px] flex-col bg-worktree-sidebar">
      <ZotzProjectSidebar />
    </div>
  )
})

// Three machines hold the project: this Mac's conversations first, then one colored list per server.
const apiMini: Repo = {
  ...repo('api-mini', 'api-pagos'),
  upstream: apiUpstream,
  executionHostId: 'runtime:mac-mini'
}
const acrossThreeMachines = {
  repos: [apiLocal, apiMsi, apiMini],
  runtimeEnvironments: [
    { ...msiRuntime, name: 'MSI Server' },
    { ...msiRuntime, id: 'mac-mini', name: 'Mac mini' }
  ],
  worktreesByRepo: {
    'api-local': [
      worktree('api-local', 'repartir-sprint', 'Repartir el sprint', { lastActivityAt: 4 })
    ],
    'api-msi': [
      worktree('api-msi', 'paginar-pacientes', 'Paginar el endpoint de pacientes', {
        lastActivityAt: 5
      }),
      worktree('api-msi', 'exportar-csv', 'Exportar reportes a CSV', { lastActivityAt: 2 })
    ],
    'api-mini': [worktree('api-mini', 'cache-redis', 'Cache con Redis', { lastActivityAt: 3 })]
  }
}

export const projectByMachine = defineFixture({
  width: 300,
  setup: stubEmptyZotzAgentQueue,
  store: acrossThreeMachines,
  render: () => (
    <div className="flex h-[300px] flex-col bg-worktree-sidebar">
      <ZotzProjectSidebar />
    </div>
  )
})

export const projectByMachineOff = defineFixture({
  width: 300,
  setup: stubEmptyZotzAgentQueue,
  store: {
    ...acrossThreeMachines,
    settings: { ...getDefaultSettings('/home/fixture'), zotzGroupRemoteByMachine: false }
  },
  render: () => (
    <div className="flex h-[300px] flex-col bg-worktree-sidebar">
      <ZotzProjectSidebar />
    </div>
  )
})
