import type { LocationGroup, ParsedAsset } from '@/types/asset'
import { planDeck } from '../plan'

function asset(id: string, days: number): ParsedAsset {
  const d = new Date(2026, 0, 1)
  return {
    assetId: id,
    productName: 'P',
    locationId: 'L',
    locationName: 'L',
    city: '',
    country: '',
    installDate: d,
    contractEnd: d,
    daysRemaining: days,
    endOfSupport: null,
    barEnd: d,
  }
}

function loc(
  name: string,
  product: string,
  assets: ParsedAsset[],
  city = '',
  country = '',
): LocationGroup {
  const d = new Date(2026, 0, 1)
  return {
    locationId: name,
    locationName: name,
    city,
    country,
    productGroups: [{ productName: product, assets, groupStart: d, groupEnd: d }],
    locationStart: d,
    locationEnd: d,
  }
}

describe('planDeck', () => {
  it('throws on empty input', () => {
    expect(() => planDeck([])).toThrow('Nothing to export')
  })

  it('computes totals and overview', () => {
    const plan = planDeck([
      loc('A', 'P', [asset('1', -5), asset('2', 100)], 'Paris', 'FR'),
      loc('B', 'P', [asset('3', 900)]),
    ])
    expect(plan.totals).toEqual({ locations: 2, assets: 3, underOneYear: 1, expired: 1 })
    expect(plan.overview[0]).toEqual({
      location: 'A, Paris, FR',
      ok: 0,
      warning: 0,
      critical: 1,
      expired: 1,
      total: 2,
    })
    expect(plan.overview[1]?.ok).toBe(1)
    expect(plan.slides[0]?.subtitle).toBe('2 assets')
  })

  it('paginates with continuation slides', () => {
    const assets = Array.from({ length: 20 }, (_, i) => asset(`a${i}`, 900))
    const plan = planDeck([loc('A', 'P', assets)], 14)
    expect(plan.slides.map((s) => s.title)).toEqual(['A', 'A (continued)'])
    expect(plan.slides[1]?.subtitle).toBe('20 assets')
    const n = plan.slides.flatMap((s) => s.rows).filter((r) => r.kind === 'asset').length
    expect(n).toBe(20)
    expect(plan.slides[1]?.rows[0]?.kind).toBe('asset')
  })

  it('never leaves a group header last on a slide', () => {
    const g = loc(
      'A',
      'P1',
      Array.from({ length: 12 }, (_, i) => asset(`a${i}`, 900)),
    )
    const d = new Date(2026, 0, 1)
    g.productGroups.push({
      productName: 'P2',
      assets: [asset('x', 900), asset('y', 900)],
      groupStart: d,
      groupEnd: d,
    })
    const plan = planDeck([g], 14) // header + 12 = 13 rows; P2 header would be the 14th
    expect(plan.slides[0]?.rows.at(-1)?.kind).toBe('asset')
    expect(plan.slides[1]?.rows[0]).toEqual({ kind: 'group', label: 'P2 (2)' })
  })

  it('truncates long labels to 44 chars', () => {
    const plan = planDeck([loc('A', 'x'.repeat(60), [asset('1', 900)])])
    const label = plan.slides[0]?.rows[0]?.label ?? ''
    expect(label).toHaveLength(44)
    expect(label.endsWith('…')).toBe(true)
  })
})
