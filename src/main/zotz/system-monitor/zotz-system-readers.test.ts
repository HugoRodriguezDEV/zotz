import { describe, expect, it } from 'vitest'
import { parseDarwinNetstat } from './zotz-system-darwin-sampler'
import { parseLinuxDiskstats, parseLinuxSwap } from './zotz-system-linux-sampler'
import { zotzNetworkRates } from './zotz-system-rates'
import { parseZotzWindowsSamplerLine } from './zotz-system-windows-sampler'

const NETSTAT = `Name       Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll
lo0        16384 <Link#1>                        812345     0  301234567   812345     0  301234567     0
lo0        16384 127           127.0.0.1         812345     -  301234567   812345     -  301234567     -
en0        1500  <Link#11>   3c:a6:f6:10:22:33  9876543     0 52475661342  4567890     0 6033910073     0
en0        1500  192.168.1     192.168.1.20      9876543     - 52475661342  4567890     - 6033910073     -
utun3      1380  <Link#20>                          1200     0     345678     1100     0     223344     0
`

describe('parseDarwinNetstat', () => {
  it('reads byte counters from link rows only, and totals skip loopback and tunnels', () => {
    const counters = parseDarwinNetstat(NETSTAT)
    expect(counters).toEqual([
      { name: 'lo0', rxBytes: 301234567, txBytes: 301234567 },
      { name: 'en0', rxBytes: 52475661342, txBytes: 6033910073 },
      { name: 'utun3', rxBytes: 345678, txBytes: 223344 }
    ])
    const later = counters!.map((entry) => ({
      ...entry,
      rxBytes: entry.rxBytes + 4_000_000,
      txBytes: entry.txBytes + 400_000
    }))
    const rates = zotzNetworkRates('darwin', counters!, later, 2)
    expect(rates.downBps).toBe(2_000_000)
    expect(rates.upBps).toBe(200_000)
    expect(rates.interfaces).toEqual([{ name: 'en0', downBps: 2_000_000, upBps: 200_000 }])
  })
})

describe('linux readers', () => {
  it('turns diskstats sectors into bytes', () => {
    const text = '   8       0 sda 120 5 4096 300 80 2 2048 150 0 400 450 0 0 0 0\n'
    expect(parseLinuxDiskstats(text)).toEqual([
      { id: 'sda', readBytes: 2_097_152, writeBytes: 1_048_576 }
    ])
  })

  it('reads swap from meminfo', () => {
    expect(parseLinuxSwap('SwapTotal:       2097148 kB\nSwapFree:         524284 kB\n')).toEqual({
      totalBytes: 2_147_479_552,
      usedBytes: 1_610_612_736
    })
  })
})

describe('parseZotzWindowsSamplerLine', () => {
  it('reads one CIM sampler line', () => {
    const line = JSON.stringify({
      net: [
        { n: 'Intel[R] Wi-Fi 6 AX201 160MHz', d: 1_500_000, u: 120_000 },
        { n: 'isatap.{1234}', d: 50, u: 50 }
      ],
      disk: { r: 2_048_000.4, w: 512_000 },
      gpu: 37.5,
      gm: 'NVIDIA GeForce RTX 3060 Laptop GPU',
      swap: { t: 4096, u: 1024 },
      bat: { p: 64, s: 1, m: 95 },
      procs: ['4242\t812\tnode#2\t125\t734003200', '0\t0\tIdle\t800\t8192', 'garbage']
    })
    expect(parseZotzWindowsSamplerLine(line)).toEqual({
      network: {
        downBps: 1_500_000,
        upBps: 120_000,
        receivedBytes: null,
        sentBytes: null,
        defaultInterface: null,
        interfaces: [{ name: 'Intel[R] Wi-Fi 6 AX201 160MHz', downBps: 1_500_000, upBps: 120_000 }]
      },
      diskIo: { readBps: 2_048_000, writeBps: 512_000 },
      gpu: { model: 'NVIDIA GeForce RTX 3060 Laptop GPU', percent: 37.5 },
      battery: { percent: 64, state: 'discharging', minutesLeft: 95 },
      onBattery: true,
      swap: { totalBytes: 4_294_967_296, usedBytes: 1_073_741_824 },
      processes: [
        {
          pid: 4242,
          ppid: 812,
          name: 'node',
          command: 'node',
          user: null,
          cpuPercent: 125,
          memoryBytes: 734_003_200
        }
      ]
    })
  })

  it('ignores a line that is not JSON', () => {
    expect(parseZotzWindowsSamplerLine('WARNING: something')).toBeNull()
  })
})
