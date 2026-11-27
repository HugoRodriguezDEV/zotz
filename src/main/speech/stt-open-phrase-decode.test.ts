import { describe, expect, it, vi } from 'vitest'
import { openPhraseLiveText } from './stt-open-phrase-decode'
import { VadPauseSegmenter, type VadStream } from './stt-vad-pause-segmenter'

const RATE = 16000

class SpeakingSegmenter extends VadPauseSegmenter {
  heard: Float32Array | null = null
  override openPhraseAudio(): Float32Array | null {
    return this.heard
  }
}

function speaking() {
  const vad: VadStream = { streamFeed: vi.fn(), streamFlush: vi.fn() }
  const segmenter = new SpeakingSegmenter(vad, RATE, 512)
  return { segmenter, options: {}, span: { texts: ['Primera frase.'] } }
}

const seconds = (s: number) => new Float32Array(Math.round(s * RATE))

describe('open phrase live text', () => {
  it('decodes the phrase still being spoken every half second, after the span so far', async () => {
    const stream = speaking()
    const transcribe = vi.fn(async () => 'quiero que el monitor')
    stream.segmenter.heard = seconds(0.3)
    expect(await openPhraseLiveText(stream, RATE, transcribe)).toBeNull()
    stream.segmenter.heard = seconds(0.6)
    expect(await openPhraseLiveText(stream, RATE, transcribe)).toBe(
      'Primera frase. quiero que el monitor'
    )
    stream.segmenter.heard = seconds(0.8)
    expect(await openPhraseLiveText(stream, RATE, transcribe)).toBeNull()
    expect(transcribe).toHaveBeenCalledTimes(1)
  })

  it('stops early decodes on a machine too slow to keep up with the speaker', async () => {
    const stream = speaking()
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const transcribe = vi.fn(async () => {
      now += 400
      return 'lento'
    })
    stream.segmenter.heard = seconds(0.6)
    await openPhraseLiveText(stream, RATE, transcribe)
    stream.segmenter.heard = seconds(1.5)
    expect(await openPhraseLiveText(stream, RATE, transcribe)).toBeNull()
    expect(transcribe).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })
})
