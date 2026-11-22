import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ZotzLinkPeerStore } from './zotz-link-peer-store'

const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })))

describe('ZotzLinkPeerStore', () => {
  it('keeps both members when the UI pushes them at the same time', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'zotz-link-peers-'))
    dirs.push(dir)
    const file = join(dir, 'zotz-link-peers.json')
    const store = new ZotzLinkPeerStore(file)
    const peer = (shortName: string) => ({
      shortName,
      title: shortName,
      machine: null,
      reach: 'direct' as const
    })

    await Promise.all([store.set('/code/a', [peer('b')]), store.set('/code/b', [peer('a')])])

    const reread = new ZotzLinkPeerStore(file)
    expect((await reread.get('/code/a'))?.peers).toEqual([peer('b')])
    expect((await reread.get('/code/b'))?.peers).toEqual([peer('a')])
  })
})
