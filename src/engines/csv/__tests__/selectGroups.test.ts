import type { ParsedAsset } from '@/types/asset'
import { STATUS_ORDER } from '@/utils/colors'
import type { Filters } from '@store/assetStore'
import { groupAssets } from '../assetGrouper'
import { selectGroups } from '../selectGroups'

function makeAsset(over: Partial<ParsedAsset>): ParsedAsset {
  const contractEnd = new Date(2027, 0, 1)
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

const groups = groupAssets([
  makeAsset({ assetId: 'OK', productName: 'Alpha', locationId: 'L1', daysRemaining: 1000 }),
  makeAsset({ assetId: 'EXP', productName: 'Beta', locationId: 'L1', daysRemaining: -50 }),
  makeAsset({ assetId: 'CRIT', productName: 'Gamma', locationId: 'L2', daysRemaining: 100 }),
])
const all: Filters = { locationIds: [], search: '', statuses: STATUS_ORDER }
const ids = (gs: typeof groups) =>
  gs.flatMap((g) => g.productGroups.flatMap((pg) => pg.assets.map((a) => a.assetId))).sort()

describe('selectGroups', () => {
  it('returns the input unchanged for default filters', () => {
    expect(selectGroups(groups, all)).toBe(groups)
  })

  it('restricts by location', () => {
    expect(ids(selectGroups(groups, { ...all, locationIds: ['L2'] }))).toEqual(['CRIT'])
  })

  it('restricts by status', () => {
    expect(ids(selectGroups(groups, { ...all, statuses: ['expired'] }))).toEqual(['EXP'])
  })

  it('keeps only assets matching the search (case-insensitive, name + id)', () => {
    expect(ids(selectGroups(groups, { ...all, search: 'GAMMA (crit)' }))).toEqual(['CRIT'])
  })

  it('falls back to the pre-search groups when the search matches nothing', () => {
    expect(selectGroups(groups, { ...all, search: 'zzz' })).toBe(groups)
  })
})
