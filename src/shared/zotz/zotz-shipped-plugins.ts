import {
  OFFICIAL_PLUGIN_PUBLISHER,
  splitQualifiedPluginKey
} from '../plugins/catalog/plugin-marketplace'

/** Publisher of the plugins Zotz ships in `resources/plugins/launch`. */
const ZOTZ_PLUGIN_PUBLISHER = 'zotz'

/** Shipped plugins may be Orca's official ones or Zotz's own. */
export function isShippedPluginPublisher(pluginKey: string): boolean {
  const publisher = splitQualifiedPluginKey(pluginKey)?.publisher
  return publisher === OFFICIAL_PLUGIN_PUBLISHER || publisher === ZOTZ_PLUGIN_PUBLISHER
}
