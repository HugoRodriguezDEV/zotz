import { defineFixture } from '../../../component-fixtures/component-fixture'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import RunTargetCombobox from '@/components/new-workspace/run-target/RunTargetCombobox'
import { SetProjectLocationDialog } from '@/components/new-workspace/project-location/SetProjectLocationDialog'
import {
  buildProjectHostSetupOptions,
  type NeedsSetupProjectHostOption
} from '@/lib/workspace/creation/project-host-setup-options'
import {
  PROJECT_HOST_SETUP_RUNTIME_CAPABILITY,
  WORKSPACE_RUN_CONTEXT_RUNTIME_CAPABILITY
} from '../../../../../shared/remote-runtime/protocol/worktree-runtime-capabilities'
import type { ExecutionHostRegistryEntry } from '../../../../../shared/execution-host/execution-host-registry-entry'
import type { ProjectHostSetup } from '../../../../../shared/project/project-types'
import type { Repo } from '../../../../../shared/repository/repo-types'
import { ZotzNewHostFolderForm } from './ZotzNewHostFolderForm'

// A folder project that only exists on the Mac, with a paired Zotz server and an SSH host.
const projectId = 'repo:home'
const hosts: ExecutionHostRegistryEntry[] = [
  { id: 'local', kind: 'local', label: 'Local Mac', detail: '', health: 'local' },
  {
    id: 'runtime:msi',
    kind: 'runtime',
    label: 'MSI Server',
    detail: '',
    health: 'available',
    capabilities: [PROJECT_HOST_SETUP_RUNTIME_CAPABILITY, WORKSPACE_RUN_CONTEXT_RUNTIME_CAPABILITY]
  },
  { id: 'ssh:colima', kind: 'ssh', label: 'colima', detail: '', health: 'disconnected' }
]
const setups: ProjectHostSetup[] = [
  {
    id: 'home-local',
    projectId,
    hostId: 'local',
    repoId: 'home',
    path: '/Users/hugo',
    displayName: '~',
    kind: 'folder',
    setupState: 'ready',
    setupMethod: 'imported-existing-folder',
    createdAt: 0,
    updatedAt: 0
  }
]
const repos: Repo[] = [
  { id: 'home', path: '/Users/hugo', kind: 'folder', displayName: '~', badgeColor: '', addedAt: 0 }
]
const options = buildProjectHostSetupOptions({
  projectId,
  projectHostSetups: setups,
  eligibleRepos: repos,
  hosts
})
const msiOption = options.find(
  (option): option is NeedsSetupProjectHostOption => option.hostId === 'runtime:msi'
)!

export const runTarget = defineFixture({
  width: 420,
  render: () => (
    <div className="h-[300px] p-4">
      <RunTargetCombobox
        hostOptions={options}
        hostValue="home-local"
        hostExecutionHostId="local"
        onHostChange={() => {}}
        recipes={[]}
        recipeValue={null}
        onAddSshHost={() => {}}
        onAddRemoteServer={() => {}}
        onConnectHost={async () => {}}
        onSetLocation={() => {}}
      />
    </div>
  ),
  interact: (frame) => {
    frame.querySelector<HTMLInputElement>('[aria-label="Run on"][role="combobox"]')?.focus()
  }
})

export const dialog = defineFixture({
  width: 560,
  render: () => (
    <div className="h-[340px]">
      <SetProjectLocationDialog
        option={msiOption}
        projectName="~"
        projectKind="folder"
        defaultCloneUrl=""
        onClose={() => {}}
        onReady={() => {}}
      />
    </div>
  )
})

export const newFolder = defineFixture({
  width: 560,
  render: () => (
    <div className="h-[300px]">
      <Dialog open>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Set project location</DialogTitle>
          </DialogHeader>
          <ZotzNewHostFolderForm
            environmentId="msi"
            onBack={() => {}}
            onReady={() => {}}
            resolveParent={async () => 'C:\\Users\\hugo\\zotz\\projects'}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
})
