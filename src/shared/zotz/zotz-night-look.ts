import type { GlobalSettings } from '../global-settings-types'
import { defaultTerminalFontFamily } from '../terminal/appearance/terminal-platform-defaults'

// Why no plugin helpers: constants.ts reaches the mobile web bundle, and they pull in zod.
const ZOTZ_NIGHT_PLUGIN_KEY = 'zotz.zotz-night'
export const ZOTZ_NIGHT_APP_THEME = `plugin:${ZOTZ_NIGHT_PLUGIN_KEY}/zotz-night` as const
export const ZOTZ_NIGHT_TERMINAL_THEME = ZOTZ_NIGHT_APP_THEME
// The names pluginFontFamilyName registers the plugin's families under.
export const ZOTZ_NIGHT_APP_FONT = `Karla (${ZOTZ_NIGHT_PLUGIN_KEY})`
export const ZOTZ_NIGHT_TERMINAL_FONT = `Atkinson Hyperlegible Mono (${ZOTZ_NIGHT_PLUGIN_KEY})`

// Orca's own defaults, which mark a profile whose look nobody picked.
const ORCA_DEFAULT_TERMINAL_THEME_DARK = 'Ghostty Default Style Dark'
const ORCA_DEFAULT_APP_FONT = 'Geist'

type ZotzNightLookSettings = Pick<
  GlobalSettings,
  | 'theme'
  | 'pluginAppThemeDark'
  | 'terminalThemeDark'
  | 'appFontFamily'
  | 'terminalFontFamily'
  | 'zotzNightLookApplied'
>

/** A fresh profile's look: dark Zotz Night, Karla for the interface and Atkinson Hyperlegible Mono. */
export function zotzNightLookDefaults(): ZotzNightLookSettings {
  return {
    theme: 'dark',
    pluginAppThemeDark: ZOTZ_NIGHT_APP_THEME,
    terminalThemeDark: ZOTZ_NIGHT_TERMINAL_THEME,
    appFontFamily: ZOTZ_NIGHT_APP_FONT,
    terminalFontFamily: ZOTZ_NIGHT_TERMINAL_FONT,
    zotzNightLookApplied: true
  }
}

/**
 * Moves a saved profile to the Zotz look once, piece by piece: only the theme and fonts still on
 * Orca's defaults change, so anything the user picked stays.
 */
export function migrateZotzNightLook(
  stored: Partial<GlobalSettings> | undefined
): Partial<ZotzNightLookSettings> {
  if (!stored || stored.zotzNightLookApplied === true) {
    return {}
  }
  const look = zotzNightLookDefaults()
  const update: Partial<ZotzNightLookSettings> = { zotzNightLookApplied: true }
  const themeUntouched =
    !stored.pluginAppThemeDark &&
    !stored.pluginAppTheme &&
    stored.leftSidebarAppearanceMode !== 'match-terminal' &&
    (stored.terminalThemeDark ?? ORCA_DEFAULT_TERMINAL_THEME_DARK) ===
      ORCA_DEFAULT_TERMINAL_THEME_DARK
  if (themeUntouched) {
    update.pluginAppThemeDark = look.pluginAppThemeDark
    update.terminalThemeDark = look.terminalThemeDark
    if ((stored.theme ?? 'system') === 'system') {
      update.theme = look.theme
    }
  }
  if ((stored.appFontFamily ?? ORCA_DEFAULT_APP_FONT) === ORCA_DEFAULT_APP_FONT) {
    update.appFontFamily = look.appFontFamily
  }
  const platformTerminalFont = defaultTerminalFontFamily()
  if ((stored.terminalFontFamily ?? platformTerminalFont) === platformTerminalFont) {
    update.terminalFontFamily = look.terminalFontFamily
  }
  return update
}
