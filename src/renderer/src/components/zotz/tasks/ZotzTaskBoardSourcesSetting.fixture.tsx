import { useAppStore } from '@/store/index'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzTaskBoardSourcesSetting } from './ZotzTaskBoardSourcesSetting'

const PROJECTS = [
  { owner: 'hugo', ownerType: 'user', number: 3, title: 'Roadmap personal', source: 'viewer' },
  {
    owner: 'acme',
    ownerType: 'organization',
    number: 1,
    title: 'Producto 2026',
    source: 'org:acme'
  },
  { owner: 'acme', ownerType: 'organization', number: 4, title: 'Soporte', source: 'org:acme' },
  {
    owner: 'zotz-labs',
    ownerType: 'organization',
    number: 7,
    title: 'Roadmap',
    source: 'org:zotz-labs'
  }
] as const

export const picker = defineFixture({
  width: 720,
  setup: () => {
    window.api.gh.listAccessibleProjects = async () => ({
      ok: true,
      projects: PROJECTS.map((project) => ({
        ...project,
        id: `${project.owner}-${project.number}`,
        url: `https://github.com/orgs/${project.owner}/projects/${project.number}`
      })),
      partialFailures: [{ owner: 'old-team', message: 'SAML required' }]
    })
  },
  render: () => {
    const settings = useAppStore.getState().settings
    return settings ? (
      <ZotzTaskBoardSourcesSetting
        settings={{
          ...settings,
          zotzTaskBoardSources: [
            {
              kind: 'github-project',
              owner: 'acme',
              ownerType: 'organization',
              number: 1,
              title: 'Producto 2026'
            }
          ]
        }}
        updateSettings={() => {}}
      />
    ) : null
  }
})
