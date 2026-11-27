import { appendDictationText } from '../../shared/speech/dictation/dictation-transcript-spacing'
import type { AudioSegmenter } from './stt-offline-audio-chunker'
import { VadPauseSegmenter } from './stt-vad-pause-segmenter'

// The phrase being spoken decodes again after each this much more audio.
const STEP_SECONDS = 0.5
// A slower decode would queue feeds behind the speaker, so that dictation stops early decodes.
const MAX_DECODE_SHARE = 0.5

type OpenPhraseState = {
  /** Length of the open phrase at its last early decode; 0 before one. */
  decoded: number
  slow: boolean
}

const states = new WeakMap<VadPauseSegmenter, OpenPhraseState>()

/**
 * Live text for a pause-cut (offline) model, so words appear as they are spoken and not only at the
 * next pause: the span's phrases so far plus an early decode of the phrase still being spoken, or
 * null when none is due. The cut phrase's own decode then replaces it. Off on a slow machine.
 */
export async function openPhraseLiveText<Options>(
  stream: { segmenter: AudioSegmenter; options: Options; span: { texts: readonly string[] } },
  modelRate: number,
  transcribe: (audio: Float32Array, options: Options) => Promise<string>
): Promise<string | null> {
  const { segmenter } = stream
  if (!(segmenter instanceof VadPauseSegmenter)) {
    return null
  }
  const state = states.get(segmenter) ?? { decoded: 0, slow: false }
  states.set(segmenter, state)
  const audio = state.slow ? null : segmenter.openPhraseAudio()
  if (!audio || audio.length < state.decoded) {
    state.decoded = 0
  }
  if (!audio || audio.length - state.decoded < STEP_SECONDS * modelRate) {
    return null
  }
  state.decoded = audio.length
  const startedAt = performance.now()
  const text = (await transcribe(audio, stream.options)).trim()
  if (performance.now() - startedAt > STEP_SECONDS * 1000 * MAX_DECODE_SHARE) {
    state.slow = true
  }
  return text ? [...stream.span.texts, text].reduce(appendDictationText, '') : null
}
