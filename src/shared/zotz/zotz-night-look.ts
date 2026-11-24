import type { GlobalSettings } from '../global-settings-types'
import {
  OFFICIAL_PLUGIN_PUBLISHER,
  splitQualifiedPluginKey
} from '../plugins/catalog/plugin-marketplace'
import { pluginFontFamilyName } from '../plugins/contributions/plugin-font-contribution'
import { defaultTerminalFontFamily } from '../terminal/appearance/terminal-platform-defaults'

/** Publisher of the plugins Zotz ships in `resources/plugins/launch`. */
export const ZOTZ_PLUGIN_PUBLISHER = 'zotz'

const ZOTZ_NIGHT_PLUGIN_KEY = `${ZOTZ_PLUGIN_PUBLISHER}.zotz-night`
export const ZOTZ_NIGHT_APP_THEME = `plugin:${ZOTZ_NIGHT_PLUGIN_KEY}/zotz-night` as const
export const ZOTZ_NIGHT_TERMINAL_THEME = ZOTZ_NIGHT_APP_THEME
export const ZOTZ_NIGHT_APP_FONT = pluginFontFamilyName(ZOTZ_NIGHT_PLUGIN_KEY, 'Karla')
export const ZOTZ_NIGHT_TERMINAL_FONT = pluginFontFamilyName(
  ZOTZ_NIGHT_PLUGIN_KEY,
  'Atkinson Hyperlegible Mono'
)

// Orca's own defaults, which mark a profile whose look nobody picked.
const ORCA_DEFAULT_TERMINAL_THEME_DARK = 'Ghostty Default Style Dark'
const ORCA_DEFAULT_APP_FONT = 'Geist'

/** Shipped plugins may be Orca's official ones or Zotz's own. */
export function isShippedPluginPublisher(pluginKey: string): boolean {
  const publisher = splitQualifiedPluginKey(pluginKey)?.publisher
  return publisher === OFFICIAL_PLUGIN_PUBLISHER || publisher === ZOTZ_PLUGIN_PUBLISHER
}

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
