import { Badge } from '@/components/ui/badge'
import type { Translate } from '@/i18n/use-translate'
import type { ZotzMemoryPressure } from '../../../../../shared/zotz/agent-queue/zotz-memory-pressure'
import type {
  ZotzSystemReading,
  ZotzSystemSample
} from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import type { ZotzSystemChartSeries } from './ZotzSystemHistoryChart'

export type ZotzSystemSection = 'cpu' | 'memory' | 'network' | 'disk' | 'gpu' | 'energy'

export const ZOTZ_SYSTEM_SECTIONS: readonly ZotzSystemSection[] = [
  'cpu',
  'memory',
  'network',
  'disk',
  'gpu',
  'energy'
]

export function zotzSystemSectionTitle(section: ZotzSystemSection, t: Translate): string {
  switch (section) {
    case 'cpu':
      return t('zotz.systemMonitor.cpu', 'CPU')
    case 'memory':
      return t('zotz.systemMonitor.memory', 'Memory')
    case 'network':
      return t('zotz.systemMonitor.network', 'Network')
    case 'disk':
      return t('zotz.systemMonitor.disk', 'Disk')
    case 'gpu':
      return t('zotz.systemMonitor.gpu', 'GPU')
    case 'energy':
      return t('zotz.systemMonitor.energy', 'Energy')
  }
}

export function zotzPressureBadge(
  pressure: ZotzMemoryPressure,
  t: Translate
): React.JSX.Element | null {
  if (pressure === 'ok') {
    return null
  }
  return pressure === 'critical' ? (
    <Badge variant="destructive">{t('zotz.systemMonitor.pressureCritical', 'Critical')}</Badge>
  ) : (
    <Badge variant="outline">{t('zotz.systemMonitor.pressureElevated', 'Tight')}</Badge>
  )
}

/** The series each section charts, from the shared history. */
export function zotzSectionSeries(
  section: ZotzSystemSection,
  history: readonly ZotzSystemSample[]
): ZotzSystemChartSeries[] {
  const pick = (
    value: (sample: ZotzSystemSample) => number | null
  ): ZotzSystemChartSeries['points'] =>
    history.map((sample) => ({ t: sample.t, value: value(sample) }))
  switch (section) {
    case 'cpu':
      return [{ tone: 'primary', points: pick((s) => s.cpuPercent) }]
    case 'memory':
      return [{ tone: 'primary', points: pick((s) => s.memoryUsedBytes) }]
    case 'network':
      return [
        { tone: 'primary', points: pick((s) => s.netDownBps) },
        { tone: 'secondary', points: pick((s) => s.netUpBps) }
      ]
    case 'disk':
      return [
        { tone: 'primary', points: pick((s) => s.diskReadBps) },
        { tone: 'secondary', points: pick((s) => s.diskWriteBps) }
      ]
    case 'gpu':
      return [{ tone: 'primary', points: pick((s) => s.gpuPercent) }]
    case 'energy':
      return [{ tone: 'primary', points: pick((s) => s.batteryPercent) }]
  }
}

/** Percent sections pin the chart at 100; memory at the machine's total. */
export function zotzSectionMax(
  section: ZotzSystemSection,
  latest: ZotzSystemReading
): number | undefined {
  if (section === 'memory') {
    return latest.memory.totalBytes
  }
  return section === 'cpu' || section === 'gpu' || section === 'energy' ? 100 : undefined
}
