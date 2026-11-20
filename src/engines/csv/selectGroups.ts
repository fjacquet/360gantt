import type { LocationGroup } from '@/types/asset'
import type { Filters } from '@store/assetStore'
import { groupAssets } from './assetGrouper'
import { filterGroupsByStatus } from './statusFilter'

/** Applies the active chart filters (location, status, search) to location groups, as GanttPanel does. */
export function selectGroups(groups: LocationGroup[], filters: Filters): LocationGroup[] {
  const byLocation =
    filters.locationIds.length > 0
      ? groups.filter((g) => filters.locationIds.includes(g.locationId))
      : groups
  const byStatus = filterGroupsByStatus(byLocation, filters.statuses)
  if (!filters.search) return byStatus

  const needle = filters.search.toLowerCase()
  const matched = byStatus
    .flatMap((g) => g.productGroups.flatMap((pg) => pg.assets))
    .filter((a) => `${a.productName} (${a.assetId})`.toLowerCase().includes(needle))
  // Same fallback as the chart: a search that matches nothing is ignored.
  return matched.length > 0 ? groupAssets(matched) : byStatus
}
