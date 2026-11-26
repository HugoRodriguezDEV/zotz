import { describe, expect, it } from 'vitest'
import type { SpeechModelManifest } from '../../../../../shared/speech/speech-types'
import { zotzDictationModelUpgrade } from './zotz-dictation-model-upgrade'

function model(
  id: string,
  rates: Record<string, number>,
  extra: Partial<SpeechModelManifest> = {}
): SpeechModelManifest {
  const languages = Object.keys(rates)
  return {
    id,
    label: id,
    type: 'transducer',
    provider: 'local',
    language: languages.length > 1 ? 'multilingual' : languages[0],
    languages,
    errorRates: Object.entries(rates).map(([language, percent]) => ({
      language,
      percent,
      metric: 'wer',
      test: 'fleurs',
      clips: 5,
      measuredOn: '2026-11-09'
    })),
    sampleRate: 16000,
    streaming: false,
    ...extra
  }
}

const englishOnly = model('english-only', { en: 2.8 })
const multilingual = model('multilingual', { en: 3.7, es: 1.7 }, { recommended: true })
const heavier = model('heavier', { en: 4.5, es: 1.7 })
const catalog = [englishOnly, multilingual, heavier]

describe('zotz dictation model upgrade', () => {
  it('moves an English-only model to the best one for every language a bilingual user speaks', () => {
    const voice = { enabled: true, sttModel: 'english-only' }
    expect(zotzDictationModelUpgrade(voice, catalog, ['en', 'es'], true)?.id).toBe('multilingual')
    expect(zotzDictationModelUpgrade(voice, catalog, ['en', 'es'], false)?.id).toBe('multilingual')
  })

  it('keeps a model that already hears every spoken language, a cloud model, or dictation off', () => {
    expect(
      zotzDictationModelUpgrade({ enabled: true, sttModel: 'english-only' }, catalog, ['en'], true)
    ).toBeNull()
    expect(
      zotzDictationModelUpgrade({ enabled: true, sttModel: 'heavier' }, catalog, ['en', 'es'], true)
    ).toBeNull()
    const cloud = model('cloud', { en: 3 }, { provider: 'openai' })
    expect(
      zotzDictationModelUpgrade(
        { enabled: true, sttModel: 'cloud' },
        [...catalog, cloud],
        ['es'],
        true
      )
    ).toBeNull()
    expect(
      zotzDictationModelUpgrade({ enabled: false, sttModel: 'english-only' }, catalog, ['es'], true)
    ).toBeNull()
  })
})
