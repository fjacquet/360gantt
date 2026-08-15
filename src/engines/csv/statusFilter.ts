import type { ContractStatus, LocationGroup } from '@/types/asset'
import { contractStatus, STATUS_ORDER } from '@/utils/colors'
import { groupAssets } from './assetGrouper'

/**
 * Keep only assets whose contract status is in `statuses`, then re-group so summary
 * spans and ordering are recomputed for the filtered subset. Returns the input
 * unchanged when all statuses are visible (no-op fast path); returns [] when
 * `statuses` is empty. `statuses` is assumed to hold unique members of STATUS_ORDER.
 */
export function filterGroupsByStatus(
  groups: LocationGroup[],
  statuses: ContractStatus[],
): LocationGroup[] {
  if (statuses.length >= STATUS_ORDER.length) return groups
  const kept = groups
    .flatMap((g) => g.productGroups.flatMap((pg) => pg.assets))
    .filter((a) => statuses.includes(contractStatus(a.daysRemaining)))
  return groupAssets(kept)
}
