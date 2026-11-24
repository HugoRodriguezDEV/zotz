import { describe, expect, it } from 'vitest'
import { assignZotzHostColorSlots } from './zotz-host-color-slots'

const hosts = ['runtime:msi', 'runtime:mac-mini', 'ssh:vps', 'ssh:machine-multipass', 'runtime:nas']

describe('assignZotzHostColorSlots', () => {
  it('gives up to five machines five different colors', () => {
    expect(new Set(assignZotzHostColorSlots(hosts).values()).size).toBe(5)
  })

  it('gives each machine the same color whatever order the machines arrive in', () => {
    expect(assignZotzHostColorSlots(hosts.toReversed())).toEqual(assignZotzHostColorSlots(hosts))
  })
})
