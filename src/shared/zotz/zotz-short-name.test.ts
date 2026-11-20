import { describe, expect, it } from 'vitest'
import { normalizeZotzShortName, resolveZotzShortNames } from './zotz-short-name'

describe('resolveZotzShortNames', () => {
  it('uses the folder name, on POSIX and Windows paths', () => {
    const names = resolveZotzShortNames(
      ['/Users/hugo/orca/workspaces/zotz/salmon', 'C:\\Users\\rodri\\uni\\Tarpon\\'],
      {}
    )
    expect(names.get('/Users/hugo/orca/workspaces/zotz/salmon')).toBe('salmon')
    expect(names.get('C:\\Users\\rodri\\uni\\Tarpon\\')).toBe('tarpon')
  })

  it('suffixes a repeated folder name the same way regardless of input order', () => {
    const forward = resolveZotzShortNames(['/a/rodri', '/b/rodri'], {})
    const backward = resolveZotzShortNames(['/b/rodri', '/a/rodri'], {})
    expect(forward.get('/a/rodri')).toBe('rodri')
    expect(forward.get('/b/rodri')).toBe('rodri-2')
    expect(backward).toEqual(forward)
  })

  it('lets a custom name take a folder name another workspace would default to', () => {
    const names = resolveZotzShortNames(['/a/salmon', '/b/albatross'], { '/b/albatross': 'salmon' })
    expect(names.get('/b/albatross')).toBe('salmon')
    expect(names.get('/a/salmon')).toBe('salmon-2')
  })
})

describe('normalizeZotzShortName', () => {
  it('keeps only lowercase ASCII words joined by dashes', () => {
    expect(normalizeZotzShortName('  Comunicación  Entre_Agentes! ')).toBe(
      'comunicacion-entre-agentes'
    )
    expect(normalizeZotzShortName('🦇')).toBe('')
  })
})
