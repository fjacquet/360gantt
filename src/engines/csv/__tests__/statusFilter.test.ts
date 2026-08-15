import type { ParsedAsset } from '@/types/asset'
import { STATUS_ORDER } from '@/utils/colors'
import { groupAssets } from '../assetGrouper'
import { filterGroupsByStatus } from '../statusFilter'

// daysRemaining → status: ok ≥730, warning 365–729, critical 0–364, expired <0
function makeAsset(over: Partial<ParsedAsset> = {}): ParsedAsset {
  const contractEnd = over.contractEnd ?? new Date(2027, 0, 1)
  return {
    assetId: 'A',
    productName: 'P',
    locationId: 'L1',
    locationName: 'DC',
    city: '',
    country: '',
    installDate: new Date(2022, 0, 1),
    contractEnd,
    daysRemaining: 1000,
    endOfSupport: null,
    barEnd: contractEnd,
    ...over,
  }
}

const okA = makeAsset({ assetId: 'OK', locationId: 'L1', daysRemaining: 1000 })
const expA = makeAsset({ assetId: 'EXP', locationId: 'L1', daysRemaining: -50 })
const critA = makeAsset({ assetId: 'CRIT', locationId: 'L2', daysRemaining: 100 })
const warnA = makeAsset({ assetId: 'WARN', locationId: 'L3', daysRemaining: 500 })
const groups = groupAssets([okA, expA, critA, warnA])

function assetIds(gs: ReturnType<typeof groupAssets>): string[] {
  return gs.flatMap((g) => g.productGroups.flatMap((pg) => pg.assets.map((a) => a.assetId))).sort()
}

describe('filterGroupsByStatus', () => {
  it('returns the input unchanged when all statuses are visible', () => {
    expect(filterGroupsByStatus(groups, STATUS_ORDER)).toBe(groups)
  })

  it('keeps only expired assets and drops emptied groups/locations', () => {
    const out = filterGroupsByStatus(groups, ['expired'])
    expect(assetIds(out)).toEqual(['EXP'])
    expect(out).toHaveLength(1) // only L1 survives
  })

  it('keeps a multi-status selection across locations', () => {
    const out = filterGroupsByStatus(groups, ['ok', 'critical'])
    expect(assetIds(out)).toEqual(['CRIT', 'OK'])
    expect(out.map((g) => g.locationId).sort()).toEqual(['L1', 'L2'])
  })

  it('returns an empty array when no statuses are visible', () => {
    expect(filterGroupsByStatus(groups, [])).toEqual([])
  })

  it('keeps only warning-bucket assets when filtered to warning', () => {
    const out = filterGroupsByStatus(groups, ['warning'])
    expect(assetIds(out)).toEqual(['WARN'])
  })
})
