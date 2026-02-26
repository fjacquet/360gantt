import { describe, expect, it } from 'vitest'
import { groupAssets } from '../assetGrouper'
import type { ParsedAsset } from '@/types/asset'

function makeAsset(overrides: Partial<ParsedAsset> = {}): ParsedAsset {
  return {
    assetId: 'A1',
    productName: 'PowerEdge R740',
    locationId: 'LOC001',
    locationName: 'Main DC',
    city: 'Geneva',
    country: 'Switzerland',
    installDate: new Date(2022, 0, 1),
    contractEnd: new Date(2027, 0, 1),
    daysRemaining: 730,
    ...overrides,
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
})
