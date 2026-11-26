import type { SpeechModelManifest, VoiceSettings } from '../../../../../shared/speech/speech-types'
import { suggestSpeechModel } from '../../settings/voice/speech-model-suggestion'

/**
 * The on-device model to move a saved dictation setup to when its model can't hear one of the
 * languages the user speaks (an English-only model for a Spanish speaker), or null when it can.
 * Cloud models and a turned-off setup are left alone.
 */
export function zotzDictationModelUpgrade(
  voice: Pick<VoiceSettings, 'enabled' | 'sttModel'> | undefined,
  catalog: readonly SpeechModelManifest[],
  spokenLanguages: readonly string[],
  favorAccuracy: boolean
): SpeechModelManifest | null {
  const current = catalog.find((m) => m.id === voice?.sttModel)
  if (!voice?.enabled || !current || current.provider !== 'local' || spokenLanguages.length < 1) {
    return null
  }
  if (spokenLanguages.every((language) => current.languages.includes(language))) {
    return null
  }
  const target = suggestSpeechModel(catalog, spokenLanguages, { favorAccuracy })
  const coversAll = spokenLanguages.every((language) => target?.languages.includes(language))
  return target && coversAll && target.id !== current.id ? target : null
}
