/** The Multipass recipe plugin Zotz ships in `resources/plugins/launch`. */
const ZOTZ_MULTIPASS_PLUGIN_KEY = 'zotz.zotz-multipass'

/** Its recipe is a POSIX `sh` script and Windows runs recipes through cmd.exe, so Windows never gets it. */
export function isBundledPluginOfferedOnPlatform(
  entry: { pluginKey: string },
  platform: NodeJS.Platform = process.platform
): boolean {
  return platform !== 'win32' || entry.pluginKey !== ZOTZ_MULTIPASS_PLUGIN_KEY
}
