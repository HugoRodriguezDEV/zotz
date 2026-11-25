import { describe, expect, it } from 'vitest'
import { estimateZotzAgentMemory, recordZotzAgentPeak } from './zotz-agent-memory-ledger'

describe('zotz agent memory ledger', () => {
  it('estimates the median of the last 20 peaks and the default without history', () => {
    let ledger = {}
    expect(estimateZotzAgentMemory(ledger, 'codex', 2500, 6000)).toBe(2500)
    // 25 runs of 1..25: only 6..25 are kept, and the median (10th of 20) is 15.
    for (let peak = 1; peak <= 25; peak++) {
      ledger = recordZotzAgentPeak(ledger, 'codex', peak)
    }
    expect(estimateZotzAgentMemory(ledger, 'codex', 2500, 6000)).toBe(15)
    expect(estimateZotzAgentMemory(ledger, 'claude', 2500, 6000)).toBe(2500)
  })

  it('never estimates above the per-agent ceiling, whatever runs that started builds recorded', () => {
    let ledger = {}
    for (const peak of [900, 12_000, 16_000, 18_000]) {
      ledger = recordZotzAgentPeak(ledger, 'claude', peak)
    }
    expect(estimateZotzAgentMemory(ledger, 'claude', 2500, 6000)).toBe(6000)
    expect(estimateZotzAgentMemory({}, 'claude', 2500, 1400)).toBe(1400)
  })
})
