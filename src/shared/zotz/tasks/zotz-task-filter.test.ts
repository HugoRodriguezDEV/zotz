import { describe, expect, it } from 'vitest'
import { matchesZotzTaskFilter, parseZotzTaskFilter, type ZotzTaskFacts } from './zotz-task-filter'

const NOW = Date.parse('2026-11-20T12:00:00')

const facts: ZotzTaskFacts = {
  text: 'login falla en safari #142 acme/web',
  state: 'open',
  type: 'issue',
  status: '🛠️ En progreso',
  column: 'In Progress',
  assignees: ['hugo'],
  labels: ['bug', 'web'],
  repo: 'acme/web',
  project: 'producto 2026',
  source: ['github', 'acme'],
  updatedAt: Date.parse('2026-11-18T09:00:00'),
  iterations: [{ startDate: '2026-11-16', duration: 14 }],
  fields: {}
}

function passes(filter: string, viewer: string | null = 'hugo'): boolean {
  return matchesZotzTaskFilter(facts, parseZotzTaskFilter(filter), viewer, NOW)
}

describe('zotz task filter', () => {
  it('reads GitHub qualifiers, negation and comma OR', () => {
    expect(passes('is:open label:bug')).toBe(true)
    expect(passes('-label:bug')).toBe(false)
    expect(passes('label:docs,web')).toBe(true)
    expect(passes('status:"in progress"')).toBe(true)
    expect(passes('-status:done repo:acme/web')).toBe(true)
    expect(passes('is:closed')).toBe(false)
  })

  it('resolves @me to the signed-in login', () => {
    expect(passes('assignee:@me')).toBe(true)
    expect(passes('assignee:@me', 'ana')).toBe(false)
    expect(passes('no:assignee')).toBe(false)
    expect(passes('has:label')).toBe(true)
  })

  it('compares dates and iterations against today', () => {
    expect(passes('updated:@today-7d')).toBe(true)
    expect(passes('updated:@today-1d')).toBe(false)
    expect(passes('updated:<@today-1d')).toBe(true)
    expect(passes('iteration:@current')).toBe(true)
    expect(passes('iteration:@next')).toBe(false)
  })

  it('matches free text against title, number and repo', () => {
    expect(passes('safari')).toBe(true)
    expect(passes('#142')).toBe(true)
    expect(passes('android')).toBe(false)
  })
})
