import type PptxGenJS from 'pptxgenjs'
import type { LocationGroup, ParsedAsset } from '@/types/asset'
import { dateToFraction } from '../axis'
import { buildPptx } from '../index'
import { type LocationSlidePlan, planDeck } from '../plan'
import { addLocationSlide } from '../slides'
import { statusColor } from '../theme'

function asset(id: string, install: Date, end: Date, days: number): ParsedAsset {
  return {
    assetId: id,
    productName: 'P',
    locationId: 'L',
    locationName: 'L',
    city: 'Geneva',
    country: 'CH',
    installDate: install,
    contractEnd: end,
    daysRemaining: days,
    endOfSupport: null,
    barEnd: end,
  }
}

function group(assets: ParsedAsset[]): LocationGroup {
  const starts = assets.map((a) => a.installDate.getTime())
  const ends = assets.map((a) => a.barEnd.getTime())
  return {
    locationId: 'L',
    locationName: 'L',
    city: 'Geneva',
    country: 'CH',
    productGroups: [
      {
        productName: 'P',
        assets,
        groupStart: new Date(Math.min(...starts)),
        groupEnd: new Date(Math.max(...ends)),
      },
    ],
    locationStart: new Date(Math.min(...starts)),
    locationEnd: new Date(Math.max(...ends)),
  }
}

describe('buildPptx', () => {
  it('builds a zip from a 3-asset fixture', async () => {
    const g = group([
      asset('a', new Date(2022, 0, 1), new Date(2030, 0, 1), 1500),
      asset('b', new Date(2023, 0, 1), new Date(2027, 0, 1), 100),
      asset('c', new Date(2020, 0, 1), new Date(2024, 0, 1), -50),
    ])
    const buf = await buildPptx({ groups: [g], sourceName: 'x.csv' })
    const bytes = new Uint8Array(buf)
    expect(bytes.byteLength).toBeGreaterThan(0)
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b])
  })

  it('rejects empty input', async () => {
    await expect(buildPptx({ groups: [], sourceName: 'x' })).rejects.toThrow('Nothing to export')
  })

  it('handles zero-length bars', async () => {
    const d = new Date(2026, 0, 1)
    await expect(
      buildPptx({ groups: [group([asset('a', d, d, 10)])], sourceName: 'x' }),
    ).resolves.toBeInstanceOf(ArrayBuffer)
  })

  it('handles today outside the axis', async () => {
    const g = group([asset('a', new Date(2009, 0, 1), new Date(2010, 5, 1), -100)])
    await expect(buildPptx({ groups: [g], sourceName: 'x' })).resolves.toBeInstanceOf(ArrayBuffer)
  })
})

describe('addLocationSlide geometry', () => {
  type Opts = { x: number; y: number; w: number; h: number; fill?: { color: string } }
  type Call = { arg: string; o: Opts }

  function render(assets: ParsedAsset[], today: Date) {
    const plan = planDeck([group(assets)], 14)
    const calls: Call[] = []
    const rec = (arg: string, o: Opts) => calls.push({ arg, o })
    const pptx = { addSlide: () => ({ addShape: rec, addText: rec }) } as unknown as PptxGenJS
    addLocationSlide(pptx, plan, plan.slides[0] as LocationSlidePlan, today)
    return { plan, calls }
  }
  const bars = (calls: Call[], color: string) =>
    calls.filter((c) => c.arg === 'rect' && c.o.fill?.color === color && c.o.h === 0.22)

  it('gives a zero-length bar the minimum width', () => {
    const d = new Date(2026, 0, 1)
    const { calls } = render([asset('a', d, d, 10)], d)
    expect(bars(calls, statusColor('critical'))[0]?.o.w).toBe(0.03)
  })

  it('ends an expired bar at barEnd', () => {
    const expired = asset('e', new Date(2020, 0, 1), new Date(2024, 0, 1), -50)
    expired.barEnd = new Date(2022, 6, 1)
    const long = asset('l', new Date(2020, 0, 1), new Date(2030, 0, 1), 2000)
    const { plan, calls } = render([expired, long], new Date(2026, 0, 1))
    const bar = bars(calls, statusColor('expired'))[0]
    const f = dateToFraction(expired.barEnd, plan.axis)
    expect((bar?.o.x ?? 0) + (bar?.o.w ?? 0)).toBeCloseTo(4.3 + f * 8.5, 6)
  })

  it('draws the Today label only when today is on the axis', () => {
    const a = asset('a', new Date(2020, 0, 1), new Date(2030, 0, 1), 2000)
    const inside = render([a], new Date(2025, 0, 1)).calls
    const outside = render([a], new Date(2010, 0, 1)).calls
    expect(inside.some((c) => c.arg === 'Today')).toBe(true)
    expect(outside.some((c) => c.arg === 'Today')).toBe(false)
  })

  it('keeps 14 rows above the legend', () => {
    const assets = Array.from({ length: 13 }, (_, i) =>
      asset(`a${i}`, new Date(2020, 0, 1), new Date(2030, 0, 1), 2000),
    )
    const { calls } = render(assets, new Date(2025, 0, 1))
    const rows = bars(calls, statusColor('ok'))
    expect(rows).toHaveLength(13)
    const last = rows[rows.length - 1]
    expect((last?.o.y ?? 99) + (last?.o.h ?? 99)).toBeLessThan(6.9)
  })
})
