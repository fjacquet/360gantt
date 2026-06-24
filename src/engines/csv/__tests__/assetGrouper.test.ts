import { groupAssets } from '../assetGrouper'
import type { ParsedAsset } from '@/types/asset'

function makeAsset(overrides: Partial<ParsedAsset> = {}): ParsedAsset {
  const contractEnd = overrides.contractEnd ?? new Date(2027, 0, 1)
  return {
    assetId: 'A1',
    productName: 'PowerEdge R740',
    locationId: 'LOC001',
    locationName: 'Main DC',
    city: 'Geneva',
    country: 'Switzerland',
    installDate: new Date(2022, 0, 1),
    daysRemaining: 730,
    endOfSupport: null,
    ...overrides,
    contractEnd,
    barEnd: overrides.barEnd ?? contractEnd,
  }
}

describe('groupAssets', () => {
  it('groups assets by locationId → productName', () => {
    const assets: ParsedAsset[] = [
      makeAsset({ assetId: 'A1', locationId: 'L1', productName: 'Server A' }),
      makeAsset({ assetId: 'A2', locationId: 'L1', productName: 'Server A' }),
      makeAsset({ assetId: 'B1', locationId: 'L1', productName: 'Storage B' }),
      makeAsset({ assetId: 'C1', locationId: 'L2', productName: 'Server A', locationName: 'Remote DC' }),
    ]

    const groups = groupAssets(assets)
    expect(groups).toHaveLength(2)

    const l1 = groups.find((g) => g.locationId === 'L1')
    expect(l1?.productGroups).toHaveLength(2)

    const serverA = l1?.productGroups.find((p) => p.productName === 'Server A')
    expect(serverA?.assets).toHaveLength(2)
  })

  it('computes groupStart as earliest installDate', () => {
    const assets: ParsedAsset[] = [
      makeAsset({ assetId: 'A1', installDate: new Date(2020, 0, 1), contractEnd: new Date(2026, 0, 1) }),
      makeAsset({ assetId: 'A2', installDate: new Date(2022, 0, 1), contractEnd: new Date(2028, 0, 1) }),
    ]
    const groups = groupAssets(assets)
    const pg = groups[0]?.productGroups[0]
    expect(pg?.groupStart.getFullYear()).toBe(2020)
    expect(pg?.groupEnd.getFullYear()).toBe(2028)
  })

  it('sorts locations by end date (soonest first)', () => {
    const assets: ParsedAsset[] = [
      makeAsset({ locationId: 'L_LATE', contractEnd: new Date(2030, 0, 1) }),
      makeAsset({ locationId: 'L_SOON', contractEnd: new Date(2025, 0, 1) }),
    ]
    const groups = groupAssets(assets)
    expect(groups[0]?.locationId).toBe('L_SOON')
  })

  it('returns empty array for empty input', () => {
    expect(groupAssets([])).toEqual([])
  })

  it('computes locationStart/End across multiple product groups', () => {
    const assets: ParsedAsset[] = [
      makeAsset({ assetId: 'A', productName: 'P1', installDate: new Date(2019, 0, 1), contractEnd: new Date(2025, 0, 1) }),
      makeAsset({ assetId: 'B', productName: 'P2', installDate: new Date(2021, 0, 1), contractEnd: new Date(2030, 0, 1) }),
    ]
    const groups = groupAssets(assets)
    const loc = groups[0]
    expect(loc?.locationStart.getFullYear()).toBe(2019)
    expect(loc?.locationEnd.getFullYear()).toBe(2030)
  })

  it('extends group/location span to barEnd', () => {
    const assets: ParsedAsset[] = [
      makeAsset({
        assetId: 'EXP',
        contractEnd: new Date(2024, 0, 1),
        barEnd: new Date(2030, 0, 1),
        daysRemaining: -100,
      }),
    ]
    const groups = groupAssets(assets)
    expect(groups[0]?.productGroups[0]?.groupEnd.getFullYear()).toBe(2030)
    expect(groups[0]?.locationEnd.getFullYear()).toBe(2030)
  })

  it('sorts overdue (expired) locations ahead of active ones despite a later barEnd', () => {
    const assets: ParsedAsset[] = [
      makeAsset({
        locationId: 'L_ACTIVE',
        contractEnd: new Date(2028, 0, 1),
        barEnd: new Date(2028, 0, 1),
        daysRemaining: 700,
      }),
      makeAsset({
        locationId: 'L_EXPIRED',
        contractEnd: new Date(2024, 0, 1),
        barEnd: new Date(2030, 0, 1),
        daysRemaining: -100,
      }),
    ]
    const groups = groupAssets(assets)
    expect(groups[0]?.locationId).toBe('L_EXPIRED')
  })

  it('orders a mixed location group by its max contractEnd, not barEnd', () => {
    const assets: ParsedAsset[] = [
      // Mixed group (same location + product): an overdue asset whose bar extends to 2030,
      // plus a live sibling that caps the group's max contractEnd at 2027.
      makeAsset({
        assetId: 'EXP',
        locationId: 'L_MIX',
        contractEnd: new Date(2023, 0, 1),
        barEnd: new Date(2030, 0, 1),
        daysRemaining: -800,
      }),
      makeAsset({
        assetId: 'LIVE',
        locationId: 'L_MIX',
        contractEnd: new Date(2027, 0, 1),
        barEnd: new Date(2027, 0, 1),
        daysRemaining: 600,
      }),
      // A separate, later single-asset location.
      makeAsset({
        locationId: 'L_LATE',
        contractEnd: new Date(2028, 0, 1),
        barEnd: new Date(2028, 0, 1),
        daysRemaining: 900,
      }),
    ]
    const groups = groupAssets(assets)
    // L_MIX's sort key is its max contractEnd (2027), NOT its max barEnd (2030),
    // so it precedes L_LATE (2028). If the aggregate sort keyed on barEnd, L_MIX
    // (2030) would sort last — this pins that it keys on contractEnd.
    expect(groups.map((g) => g.locationId)).toEqual(['L_MIX', 'L_LATE'])
  })
})
