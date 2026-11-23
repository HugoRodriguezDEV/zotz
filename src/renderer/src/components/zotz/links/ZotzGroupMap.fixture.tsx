import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzGroupMap, type ZotzGroupMapNode } from './ZotzGroupMap'

const NODES: ZotzGroupMapNode[] = [
  { key: 'panel', label: 'palolo', detail: 'avena.io-panel', state: 'working', current: true },
  { key: 'api', label: 'barracuda', detail: 'avena-news', state: 'waiting', current: false },
  { key: 'app', label: 'tautog', detail: 'avena-argos', state: 'done', current: false },
  { key: 'child', label: 'marca-pagina', detail: 'avena.io', state: 'working', current: false }
]

// The panel and the API talk a lot; the app checks in once; a child its agent created hangs off it.
export const busyGroup = defineFixture({
  width: 300,
  render: () => (
    <div className="p-2">
      <ZotzGroupMap
        nodes={NODES}
        edges={[
          { a: 0, b: 1, count: 9, lastAt: 3 },
          { a: 0, b: 2, count: 2, lastAt: 2 },
          { a: 1, b: 2, count: 1, lastAt: 1 }
        ]}
        parentEdges={[{ child: 3, parent: 2 }]}
        activeEdges={new Set(['0-1'])}
        selected={null}
        onSelect={() => {}}
      />
    </div>
  )
})
