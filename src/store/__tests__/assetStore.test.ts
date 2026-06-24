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
})
