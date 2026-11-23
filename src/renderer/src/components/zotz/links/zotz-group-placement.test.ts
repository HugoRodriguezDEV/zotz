import { describe, expect, it } from 'vitest'
import { placeZotzCreatedConversations } from './zotz-group-placement'

const mac = (path: string) => ({ hostId: 'local' as const, path })
const groups = [{ id: 'g', name: 'Citas', createdAt: 1, members: [mac('/panel')] }]
const memberOf = (_host: string, id: string) => (id === 'panel-id' ? mac('/panel') : null)

describe('placeZotzCreatedConversations', () => {
  it("puts a child in its parent's group, once", () => {
    const created = [
      { member: mac('/backend'), worktreeId: 'b', provenance: { zotzParentWorktreeId: 'panel-id' } }
    ]
    const first = placeZotzCreatedConversations({
      groups,
      created,
      placed: new Set(),
      memberOf,
      now: 2,
      newId: () => 'new'
    })
    expect(first.groups[0].members).toEqual([mac('/panel'), mac('/backend')])
    expect(first.placed).toEqual(['local\n/backend'])
    const again = placeZotzCreatedConversations({
      groups: [{ ...groups[0], members: [mac('/panel')] }],
      created,
      placed: new Set(first.placed),
      memberOf,
      now: 3,
      newId: () => 'new'
    })
    expect(again.changed).toBe(false)
  })

  it('joins the --group by name, creating it when missing', () => {
    const result = placeZotzCreatedConversations({
      groups,
      created: [
        { member: mac('/a'), worktreeId: 'a', provenance: { zotzGroup: ' citas ' } },
        { member: mac('/b'), worktreeId: 'b', provenance: { zotzGroup: 'Pagos' } }
      ],
      placed: new Set(),
      memberOf,
      now: 2,
      newId: () => 'pagos'
    })
    expect(result.groups.map((g) => [g.name, g.members.map((m) => m.path)])).toEqual([
      ['Citas', ['/panel', '/a']],
      ['Pagos', ['/b']]
    ])
  })
})
