import { useAssetStore } from '@store/assetStore'
import { STATUS_ORDER } from '@utils/colors'

describe('assetStore status filter state', () => {
  beforeEach(() => {
    useAssetStore.getState().reset()
  })

  it('defaults filters.statuses to all status buckets', () => {
    expect(useAssetStore.getState().filters.statuses).toEqual(STATUS_ORDER)
  })

  it('merges statuses via setFilters without dropping other filters', () => {
    useAssetStore.getState().setFilters({ search: 'foo' })
    useAssetStore.getState().setFilters({ statuses: ['expired'] })
    const f = useAssetStore.getState().filters
    expect(f.statuses).toEqual(['expired'])
    expect(f.search).toBe('foo')
  })

  it('resets filters when new data is loaded', () => {
    useAssetStore
      .getState()
      .setFilters({ statuses: ['expired'], search: 'foo', locationIds: ['L9'] })
    useAssetStore.getState().setData([], { tasks: [], links: [] }, 0, 'new.csv')
    const f = useAssetStore.getState().filters
    expect(f.statuses).toEqual(STATUS_ORDER)
    expect(f.search).toBe('')
    expect(f.locationIds).toEqual([])
  })
})
