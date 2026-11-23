import { describe, expect, it } from 'vitest'
import {
  canZotzLinkTogether,
  linkZotzMembers,
  moveZotzMemberToGroup,
  unlinkZotzMember,
  zotzLinkPeersFor
} from './zotz-link-groups'

const mac = (path: string) => ({ hostId: 'local' as const, path })
const msi = (path: string) => ({ hostId: 'runtime:msi' as const, path })
const ids = ['g1', 'g2']
const newId = () => ids.shift() ?? 'gx'

describe('zotz link groups', () => {
  it('merges both groups when two linked conversations are linked to each other', () => {
    let groups = linkZotzMembers([], mac('/a'), mac('/b'), 1, newId)
    groups = linkZotzMembers(groups, msi('/c'), msi('/d'), 2, newId)
    groups = linkZotzMembers(groups, mac('/b'), msi('/c'), 3, newId)
    expect(groups).toEqual([
      { id: 'g1', createdAt: 1, members: [mac('/a'), mac('/b'), msi('/c'), msi('/d')] }
    ])
  })

  it('drops a group left with one member', () => {
    const groups = [{ id: 'g', createdAt: 1, members: [mac('/a'), mac('/b')] }]
    expect(unlinkZotzMember(groups, mac('/a'))).toEqual([])
  })

  it('refuses two different servers in one group', () => {
    expect(
      canZotzLinkTogether([mac('/a'), msi('/b'), { hostId: 'runtime:mini', path: '/c' }])
    ).toBe(false)
    expect(canZotzLinkTogether([mac('/a'), msi('/b'), msi('/c')])).toBe(true)
  })

  it('tells each member how it reaches the others from its own machine', () => {
    const group = { id: 'g', createdAt: 1, members: [mac('/a'), mac('/b'), msi('/c')] }
    const describe = (m: { path: string }) => ({ shortName: m.path.slice(1), title: m.path })
    const name = (hostId: string) => (hostId === 'local' ? 'Local Mac' : 'MSI Server')
    expect(zotzLinkPeersFor(mac('/a'), group, describe, name)).toEqual([
      { shortName: 'b', title: '/b', machine: null, reach: 'direct' },
      { shortName: 'c', title: '/c', machine: 'MSI Server', reach: 'on-server' }
    ])
    expect(zotzLinkPeersFor(msi('/c'), group, describe, name)).toEqual([
      { shortName: 'a', title: '/a', machine: 'Local Mac', reach: 'reply-only' },
      { shortName: 'b', title: '/b', machine: 'Local Mac', reach: 'reply-only' }
    ])
  })

  it('keeps a named group when its last member leaves', () => {
    const groups = [{ id: 'g', name: 'Citas', createdAt: 1, members: [mac('/a')] }]
    expect(unlinkZotzMember(groups, mac('/a'))).toEqual([
      { id: 'g', name: 'Citas', createdAt: 1, members: [] }
    ])
  })

  it('moves a conversation out of its old link into a group, at the given place', () => {
    const groups = [
      { id: 'old', createdAt: 1, members: [mac('/a'), mac('/b')] },
      { id: 'g', name: 'Citas', createdAt: 2, members: [mac('/c'), mac('/d')] }
    ]
    expect(moveZotzMemberToGroup(groups, mac('/a'), 'g', 1)).toEqual([
      { id: 'g', name: 'Citas', createdAt: 2, members: [mac('/c'), mac('/a'), mac('/d')] }
    ])
  })

  it('refuses a move that would put two servers in one group', () => {
    const groups = [{ id: 'g', name: 'Citas', createdAt: 1, members: [msi('/a')] }]
    expect(moveZotzMemberToGroup(groups, { hostId: 'runtime:mini', path: '/b' }, 'g')).toBeNull()
  })
})
