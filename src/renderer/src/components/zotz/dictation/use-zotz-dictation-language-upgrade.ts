import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { useLanguageReadiness } from '@/i18n/language-readiness'
import { isPairedWebClientWindow } from '@/app-shell/chrome/desktop-window-chrome'
import { dictationSpokenLanguages } from '../../settings/voice/speech-model-quality'
import { favorsAccurateSpeechModel } from '../../settings/voice/speech-model-suggestion'
import { zotzDictationModelUpgrade } from './zotz-dictation-model-upgrade'

/**
 * Once per profile: when the saved dictation model can't hear a language the user speaks, downloads
 * one that can and switches to it only after it is ready, so dictation never stops working.
 */
export function useZotzDictationLanguageUpgrade(): void {
  const checked = useAppStore((s) => s.settings?.zotzDictationLanguagesChecked === true)
  const enabled = useAppStore((s) => s.settings?.voice?.enabled === true)
  const detection = useLanguageReadiness((s) => s.detection)
  const startedRef = useRef(false)

  useEffect(() => {
    if (checked || !enabled || !detection || startedRef.current || isPairedWebClientWindow()) {
      return
    }
    startedRef.current = true
    void (async () => {
      const settings = useAppStore.getState().settings
      const voice = settings?.voice
      const spoken = dictationSpokenLanguages(
        voice?.dictationLanguage,
        settings?.uiLanguage,
        detection.preferredTags ?? (detection.detectedTag ? [detection.detectedTag] : [])
      )
      const catalog = await window.api.speech.getCatalog()
      const target = zotzDictationModelUpgrade(
        voice,
        catalog,
        spoken,
        favorsAccurateSpeechModel(voice?.speechGpu)
      )
      if (!target) {
        await useAppStore.getState().updateSettings({ zotzDictationLanguagesChecked: true })
        return
      }
      await window.api.speech.downloadModel(target.id)
      const states = await window.api.speech.getModelStates()
      const state = states.find((s) => s.id === target.id)
      // Not ready (failed, or already downloading elsewhere): the next launch tries again.
      if (state?.status !== 'ready' || state.needsUpdate) {
        return
      }
      const latest = useAppStore.getState().settings?.voice
      if (!latest || latest.sttModel !== voice?.sttModel) {
        // The user picked a model while this downloaded; theirs stays.
        await useAppStore.getState().updateSettings({ zotzDictationLanguagesChecked: true })
        return
      }
      await useAppStore.getState().updateSettings({
        voice: { ...latest, sttModel: target.id },
        zotzDictationLanguagesChecked: true
      })
      void useAppStore.getState().refreshModelStates()
      toast.success(
        translate(
          'zotz.dictation.languageUpgrade',
          'Dictation now uses {{model}}, which understands every language you speak.',
          { model: target.label }
        )
      )
    })().catch(() => {
      // A failed download or check leaves the profile unchecked, so the next launch retries.
    })
  }, [checked, enabled, detection])
}
