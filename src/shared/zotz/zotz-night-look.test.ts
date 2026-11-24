import { describe, expect, it, vi } from 'vitest'
import { migrateZotzNightLook } from './zotz-night-look'

vi.mock('../terminal/appearance/terminal-platform-defaults', () => ({
  defaultTerminalFontFamily: () => 'SF Mono'
}))

describe('migrateZotzNightLook', () => {
  it('moves a profile still on Orca defaults to the Zotz look', () => {
    expect(
      migrateZotzNightLook({
        theme: 'system',
        pluginAppThemeDark: null,
        terminalThemeDark: 'Ghostty Default Style Dark',
        appFontFamily: 'Geist',
        terminalFontFamily: 'SF Mono'
      })
    ).toEqual({
      zotzNightLookApplied: true,
      theme: 'dark',
      pluginAppThemeDark: 'plugin:zotz.zotz-night/zotz-night',
      terminalThemeDark: 'plugin:zotz.zotz-night/zotz-night',
      appFontFamily: 'Karla (zotz.zotz-night)',
      terminalFontFamily: 'Atkinson Hyperlegible Mono (zotz.zotz-night)'
    })
  })

  it('keeps what the user picked', () => {
    expect(
      migrateZotzNightLook({
        theme: 'light',
        pluginAppThemeDark: null,
        terminalThemeDark: 'Dracula',
        appFontFamily: 'Inter',
        terminalFontFamily: 'JetBrains Mono'
      })
    ).toEqual({ zotzNightLookApplied: true })
  })

  it('runs once', () => {
    expect(migrateZotzNightLook({ zotzNightLookApplied: true, appFontFamily: 'Geist' })).toEqual({})
  })
})
