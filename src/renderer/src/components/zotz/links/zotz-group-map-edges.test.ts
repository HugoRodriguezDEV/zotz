import { describe, expect, it } from 'vitest'
import { buildZotzGroupMapEdges } from './zotz-group-map-edges'

const mail = (from: string, to: string, createdAt: number, fromLabel: string | null = null) => ({
  id: `${from}-${to}-${createdAt}`,
  from,
  to,
  fromLabel,
  subject: '',
  body: '',
  type: 'note',
  createdAt
})

describe('buildZotzGroupMapEdges', () => {
  it('counts mail per pair in both directions and skips mail outside the group', () => {
    const index = (address: string) =>
      address.includes('panel')
        ? 0
        : address.includes('api')
          ? 1
          : address.includes('app')
            ? 2
            : null
    expect(
      buildZotzGroupMapEdges(
        [
          mail('s:panel', 's:api', 1),
          mail('s:api', 's:panel', 5),
          mail('x', 's:app', 6, 's:app on MSI'),
          mail('s:panel', 's:other', 7)
        ],
        index
      )
    ).toEqual([{ a: 0, b: 1, count: 2, lastAt: 5 }])
  })
})
