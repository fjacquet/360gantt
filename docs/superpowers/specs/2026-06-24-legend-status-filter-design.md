# Filter the Gantt by contract status via an interactive legend

**Date:** 2026-06-24
**Status:** Approved (design)
**Area:** `src/store/assetStore.ts`, `src/components/inputs/FilterPanel.tsx`,
`src/components/outputs/GanttPanel.tsx`, new `src/engines/csv/statusFilter.ts`,
i18n locale files.

## Problem / goal

Since v1.2.0 the Gantt shows all hardware regardless of contract status, including
lapsed (gray/`expired`) contracts. Users now want to focus the view — e.g. "only
active" or "only expired" — by toggling contract-status buckets. `FilterPanel.tsx`
already renders a static **Legend** of the four status buckets; the goal is to make
that legend interactive so it doubles as a status filter.

## Background (existing code)

- **`ContractStatus`** (`src/types/asset.ts`): `'ok' | 'warning' | 'critical' | 'expired'`.
- **`contractStatus(daysRemaining)`** (`src/utils/colors.ts`): `< 0 → expired`,
  `< 365 → critical`, `< 730 → warning`, else `ok`. `STATUS_COLORS` maps each to a hex.
  This is the single source of truth for a bar's bucket (the same function backs the
  bar color via `contractStatusColor`).
- **Store filters** (`src/store/assetStore.ts`): `Filters = { locationIds: string[], search: string }`;
  `setFilters(partial)` shallow-merges.
- **Filter pipeline** (`src/components/outputs/GanttPanel.tsx`): (1) filter
  `locationGroups` by `locationIds`; (2) when a location filter is active, recompute
  `toGanttData(visibleGroups).tasks`, else use cached `ganttData.tasks`; (3)
  `applySearchFilter(tasks, search)` prunes the 3-level task tree by text, preserving
  non-empty parents.
- **Legend** (`FilterPanel.tsx` lines 79–95): static rows of `STATUS_COLORS[status]`
  swatch + `t('status.*')` label. The heading text `"Legend"` is currently hardcoded.
- **Location filter convention**: "none selected = all shown" (checkbox `checked` when
  `locationIds.length === 0 || includes(id)`), with a "Clear" link.

## Decisions

1. **Granularity:** toggle the **4 existing legend buckets** (`ok` / `warning` /
   `critical` / `expired`), not a simpler Active/Expired binary. Filter and legend
   stay in sync. "Active only" = leave the three non-expired on; "Expired only" = the
   reverse.
2. **Toggle model:** **classic legend toggle.** All four visible by default; clicking
   a legend row **hides** that bucket, clicking again restores it. (Different from the
   location filter's "empty = all" sentinel — the legend is a different affordance and
   the chart-legend convention is more intuitive here.)
3. **Hide, not dim:** hidden buckets are removed from the chart (consistent with how
   location/search filters prune). The legend row for a hidden bucket is shown
   dimmed/struck-through so its state is visible.
4. **All-hidden is allowed:** toggling all four off yields an empty result (same
   behavior as location/search filters that match nothing) — the last toggle is not
   blocked.
5. **Composition:** the status filter ANDs with the location and search filters.

## Design

### 1. Store (`src/store/assetStore.ts`)

- Extend `Filters`:
  ```ts
  export interface Filters {
    locationIds: string[]
    search: string
    /** Contract-status buckets currently VISIBLE. Defaults to all four. */
    statuses: ContractStatus[]
  }
  ```
- Default state: `{ locationIds: [], search: '', statuses: ['ok', 'warning', 'critical', 'expired'] }`.
- Toggling reuses the existing `setFilters` partial-merge (no new store action needed).
- Wherever filters are reset when new CSV data loads (the same place `locationIds`/
  `search` reset), reset `statuses` to all four. (Confirm the exact reset site during
  planning — likely `setData`.)

### 2. Engine helper (`src/engines/csv/statusFilter.ts`, new)

A pure, unit-tested function — the only new logic. It operates on `LocationGroup[]`
(which carries `daysRemaining`), since the flattened `GanttTask` only has `color`.

```ts
import type { ContractStatus, LocationGroup } from '@/types/asset'
import { contractStatus } from '@/utils/colors'
import { groupAssets } from './assetGrouper'

const STATUS_COUNT = 4

/**
 * Keep only assets whose contract status is in `statuses`, then re-group so spans
 * and ordering are correct for the filtered subset. Returns the input unchanged when
 * all four statuses are visible (no-op fast path); returns [] when `statuses` is empty.
 */
export function filterGroupsByStatus(
  groups: LocationGroup[],
  statuses: ContractStatus[],
): LocationGroup[] {
  if (statuses.length >= STATUS_COUNT) return groups
  const kept = groups
    .flatMap((g) => g.productGroups.flatMap((pg) => pg.assets))
    .filter((a) => statuses.includes(contractStatus(a.daysRemaining)))
  return groupAssets(kept)
}
```

Re-running `groupAssets` (already tested) recomputes `groupStart/End`,
`locationStart/End`, and sort order for the remaining assets — so a filtered view has
correct summary spans and urgency ordering, with no duplicated grouping logic.

### 3. GanttPanel pipeline (`src/components/outputs/GanttPanel.tsx`)

Insert the status filter between the location filter and `toGanttData`:

- `locationFiltered = filters.locationIds.length > 0 ? locationGroups.filter(...) : locationGroups`
- `statusActive = filters.statuses.length < 4`
- `statusFiltered = statusActive ? filterGroupsByStatus(locationFiltered, filters.statuses) : locationFiltered`
- `baseTasks = (filters.locationIds.length > 0 || statusActive) ? toGanttData(statusFiltered).tasks : ganttData.tasks`
- `tasks = filters.search ? applySearchFilter(baseTasks, filters.search) : baseTasks`

So `toGanttData` is recomputed when **either** the location or status filter is active
(today it's only the location filter). `applySearchFilter` is unchanged.

### 4. FilterPanel legend (`src/components/inputs/FilterPanel.tsx`)

- Convert each legend row from a `<div>` into a keyboard-accessible `<button>` with
  `aria-pressed={isVisible}`, calling `toggleStatus(status)`:
  ```ts
  const toggleStatus = (s: ContractStatus) => {
    const cur = filters.statuses
    setFilters({ statuses: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] })
  }
  ```
- A row whose status is **not** in `filters.statuses` renders dimmed (reduced opacity)
  with a line-through label; the swatch keeps its color but fades.
- Add a **"Show all"** link (shown only when `filters.statuses.length < 4`) that sets
  `statuses` back to all four — mirroring the locations "Clear" link.
- i18n: replace the hardcoded `"Legend"` heading with `t('filter.legend')`; add
  `t('filter.showAll')`. Status labels (`status.*`) already exist. Add the new keys to
  every locale file that defines `filter.*`/`status.*`.

## Testing

- **`statusFilter.test.ts`** (engine, pure):
  - all four statuses → identity (same reference / same groups).
  - a single status → keeps only matching assets; drops emptied product groups and
    locations; spans/order recomputed (assert via re-grouped output).
  - empty `statuses` → `[]`.
  - mixed selection across multiple locations → correct surviving counts.
- Coverage ≥ 75 % on the engine layer is maintained (the new file is pure and fully
  covered).
- The GanttPanel wiring is thin (delegates to the helper); covered indirectly by the
  helper tests plus the existing pipeline behavior.

## Out of scope

- Persisting filter state across reloads.
- Animating bar show/hide.
- Per-status asset **counts** in the legend.
- Moving the existing inline `applySearchFilter` into the engine layer (unrelated).
