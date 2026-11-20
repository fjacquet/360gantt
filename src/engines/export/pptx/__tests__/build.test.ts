import type { LocationGroup, ParsedAsset } from '@/types/asset'
import { buildPptx } from '../index'

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
