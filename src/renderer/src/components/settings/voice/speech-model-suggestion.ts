import { isOfferedSpeechModel } from '../../../../../shared/speech/models/speech-model-retirement'
import { speechModelQuality } from './speech-model-quality'
import type { SpeechGpuMode, SpeechModelManifest } from '../../../../../shared/speech/speech-types'

export type SpeechModelSuggestionOptions = {
  /** The user's current pick, which wins while it is still offered, even with its files gone. */
  selectedModelId?: string
  /** True on a Mac with Apple silicon and the GPU on, where the most accurate model is fast enough. */
  favorAccuracy: boolean
}

/** Metal runs the large models fast; other machines get the small, quick ones. */
export function favorsAccurateSpeechModel(speechGpu: SpeechGpuMode | undefined): boolean {
  const platform = window.api.platform?.get()
  return platform?.platform === 'darwin' && platform.arch === 'arm64' && speechGpu !== 'off'
}

/** The highest measured error rate across the languages, or undefined when one is not rated. */
function worstErrorRate(
  model: SpeechModelManifest,
  languages: readonly string[]
): number | undefined {
  let worst = 0
  for (const language of languages) {
    const quality = speechModelQuality(model, language)
    if (quality.kind !== 'rated') {
      return undefined
    }
    worst = Math.max(worst, quality.errorRate.percent)
  }
  return worst
}

/**
 * The on-device model one-click setup offers for the languages the user speaks (first is the main
 * one), or undefined when none handles the main one. Models covering every language come first, so
 * a bilingual user never gets an English-only model. Favoring accuracy, it is the best measured
 * model. Otherwise it is the fast pick: the model the catalog names for the main language, then the
 * recommended default, then the best measured model.
 */
export function suggestSpeechModel(
  catalog: readonly SpeechModelManifest[],
  languages: readonly string[],
  { selectedModelId, favorAccuracy }: SpeechModelSuggestionOptions
): SpeechModelManifest | undefined {
  const offered = catalog.filter((m) => m.provider === 'local' && isOfferedSpeechModel(m))
  const selected = offered.find((m) => m.id === selectedModelId)
  if (selected) {
    return selected
  }
  const primary = languages[0]
  if (!primary) {
    return undefined
  }
  const coveringAll = offered.filter((m) => languages.every((l) => m.languages.includes(l)))
  const pool = coveringAll.length > 0 ? coveringAll : offered
  const rated = coveringAll.length > 0 ? languages : [primary]
  if (!favorAccuracy) {
    const named = pool.find((m) => m.suggestedFor?.includes(primary))
    if (named) {
      return named
    }
    const recommended = pool.find((m) => m.recommended)
    if (recommended?.languages.includes(primary)) {
      return recommended
    }
  }
  let best: { model: SpeechModelManifest; percent: number } | undefined
  for (const model of pool) {
    const percent = worstErrorRate(model, rated)
    if (percent !== undefined && (!best || percent < best.percent)) {
      best = { model, percent }
    }
  }
  return best?.model ?? pool.find((m) => m.languages.includes(primary))
}
