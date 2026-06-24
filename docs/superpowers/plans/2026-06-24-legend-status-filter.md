# Legend Status Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing `FilterPanel` legend interactive so users can toggle the four contract-status buckets (OK / Warning / Critical / Expired) to show/hide those assets in the Gantt.

**Architecture:** A pure engine helper (`filterGroupsByStatus`) does the filtering by re-grouping the kept assets; the store gains a `statuses` visible-set (default all four); `GanttPanel` inserts the helper into its existing filter pipeline; `FilterPanel` turns the static legend rows into toggle buttons. A shared `STATUS_ORDER` constant removes magic numbers and DRYs the status list.

**Tech Stack:** TypeScript (strict), Zustand store, React + react-i18next, Vitest (jsdom, globals), Biome.

**Context / why:** v1.2.0 made lapsed contracts visible; users now want to focus the view ("only active", "only expired"). `FilterPanel.tsx` already renders a static 4-bucket legend — this wires it up as a filter. Spec: `docs/superpowers/specs/2026-06-24-legend-status-filter-design.md`.

**Branch:** `feat/legend-status-filter` (already checked out; spec committed there).

## Global Constraints

- **Coverage threshold ≥ 75%** (lines/functions/branches/statements) applies ONLY to `src/engines/**` and `src/utils/**` (per `vitest.config.ts` `coverage.include`). The new `statusFilter.ts` (engine) and `STATUS_ORDER` (utils) must stay covered; the store and components are out of the coverage scope.
- **Vitest globals** — do NOT import `describe`/`it`/`expect` (config has `globals: true`; `vitest/globals` is in tsconfig types).
- **Biome** is the sole linter/formatter. **TypeScript strict** — no new `as any`.
- **No magic number for the bucket count** — use `STATUS_ORDER.length`, never a literal `4`.
- **i18n:** every user-facing string goes through `t(...)`; add new keys to ALL FOUR locales (`en`, `fr`, `it`, `de`).
- **Every commit message must end with these two trailers** (verbatim):
  ```text
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PwjvYFwpYKQ3NvfnZtHtn2
  ```
- Single-file test run: `npx vitest run <path>`. Full gate: `make ci`.

---

### Task 1: `STATUS_ORDER` constant + `filterGroupsByStatus` engine helper

The core, pure, fully-tested filtering logic. Re-groups the kept assets via the existing `groupAssets`, so spans and ordering stay correct for the filtered subset.

**Files:**
- Modify: `src/utils/colors.ts` (add `STATUS_ORDER`)
- Create: `src/engines/csv/statusFilter.ts`
- Test: `src/engines/csv/__tests__/statusFilter.test.ts`

**Interfaces:**
- Consumes: `groupAssets` (`src/engines/csv/assetGrouper.ts`), `contractStatus` (`src/utils/colors.ts`), `ContractStatus`/`LocationGroup`/`ParsedAsset` (`src/types/asset.ts`).
- Produces:
  - `STATUS_ORDER: ContractStatus[]` = `['ok','warning','critical','expired']` (canonical ordered full set).
  - `filterGroupsByStatus(groups: LocationGroup[], statuses: ContractStatus[]): LocationGroup[]` — returns `groups` unchanged when all statuses are present; `[]` when `statuses` is empty.

- [ ] **Step 1: Add `STATUS_ORDER` to `src/utils/colors.ts`**

Append after the existing `STATUS_COLORS` export:

```ts
/** Canonical ordered list of all contract-status buckets (widest scope first). */
export const STATUS_ORDER: ContractStatus[] = ['ok', 'warning', 'critical', 'expired']
```

(`ContractStatus` is already imported at the top of `colors.ts`.)

- [ ] **Step 2: Write the failing test** — create `src/engines/csv/__tests__/statusFilter.test.ts`:

```ts
import { filterGroupsByStatus } from '../statusFilter'
import { groupAssets } from '../assetGrouper'
import { STATUS_ORDER } from '@/utils/colors'
import type { ParsedAsset } from '@/types/asset'

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
const groups = groupAssets([okA, expA, critA])

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
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/engines/csv/__tests__/statusFilter.test.ts`
Expected: FAIL — `../statusFilter` does not exist (module not found).

- [ ] **Step 4: Implement** — create `src/engines/csv/statusFilter.ts`:

```ts
import type { ContractStatus, LocationGroup } from '@/types/asset'
import { STATUS_ORDER, contractStatus } from '@/utils/colors'
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engines/csv/__tests__/statusFilter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run lint + typecheck**

Run: `make lint && make typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/utils/colors.ts src/engines/csv/statusFilter.ts src/engines/csv/__tests__/statusFilter.test.ts
git commit   # "feat: add STATUS_ORDER + filterGroupsByStatus engine helper" + required trailers
```

---

### Task 2: Store `statuses` field + GanttPanel wiring

Add the visible-status set to the store (default all four) and insert the helper into the GanttPanel filter pipeline. After this task the plumbing is live but behavior is unchanged (default = all visible = no-op).

**Files:**
- Modify: `src/store/assetStore.ts` (`Filters` interface lines 5-10; `initialState.filters` line 65)
- Modify: `src/components/outputs/GanttPanel.tsx` (imports; filter pipeline lines 18-34)
- Test: `src/store/__tests__/assetStore.test.ts` (create)

**Interfaces:**
- Consumes: `STATUS_ORDER` and `filterGroupsByStatus` from Task 1; `ContractStatus` (`src/types/asset.ts`).
- Produces: `Filters.statuses: ContractStatus[]` (the visible set); store default `[...STATUS_ORDER]`.

- [ ] **Step 1: Write the failing store test** — create `src/store/__tests__/assetStore.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/store/__tests__/assetStore.test.ts`
Expected: FAIL — `filters.statuses` is `undefined` (and a TS error that `statuses` is not on `Filters`).

- [ ] **Step 3: Add `statuses` to the store** — in `src/store/assetStore.ts`:

Change the imports on line 3 from:
```ts
import type { LocationGroup } from '@/types/asset'
```
to:
```ts
import type { ContractStatus, LocationGroup } from '@/types/asset'
import { STATUS_ORDER } from '@/utils/colors'
```

Extend the `Filters` interface (lines 5-10) to add the `statuses` field:
```ts
export interface Filters {
  /** Location IDs to show; empty = show all */
  locationIds: string[]
  /** Free text search on product name */
  search: string
  /** Contract-status buckets currently visible. Defaults to all of STATUS_ORDER. */
  statuses: ContractStatus[]
}
```

Update `initialState.filters` (line 65) from:
```ts
  filters: { locationIds: [], search: '' },
```
to:
```ts
  filters: { locationIds: [], search: '', statuses: [...STATUS_ORDER] },
```

- [ ] **Step 4: Run the store test to verify it passes**

Run: `npx vitest run src/store/__tests__/assetStore.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the helper into `src/components/outputs/GanttPanel.tsx`**

Add imports (after line 5, alongside the existing `toGanttData` import):
```ts
import { filterGroupsByStatus } from '@engines/csv/statusFilter'
import { STATUS_ORDER } from '@utils/colors'
```

Replace the Step 1 + Step 2 block (lines 23-31) with:
```ts
  // Step 1: filter by location using string IDs from locationGroups
  const locationFiltered =
    filters.locationIds.length > 0
      ? locationGroups.filter((g) => filters.locationIds.includes(g.locationId))
      : locationGroups

  // Step 2: filter by contract status (no-op when all buckets are visible)
  const statusActive = filters.statuses.length < STATUS_ORDER.length
  const statusFiltered = statusActive
    ? filterGroupsByStatus(locationFiltered, filters.statuses)
    : locationFiltered

  // Step 3: derive base tasks (recompute only when a location or status filter is active)
  const baseTasks =
    filters.locationIds.length > 0 || statusActive
      ? toGanttData(statusFiltered).tasks
      : ganttData.tasks
```

(The existing `// Step 3` text-search line — now Step 4 conceptually — stays unchanged: `const tasks = filters.search ? applySearchFilter(baseTasks, filters.search) : baseTasks`.)

- [ ] **Step 6: Typecheck + lint + full suite**

Run: `make typecheck && make lint && npx vitest run`
Expected: all pass (the new store test green; existing suite unaffected; GanttPanel compiles with the new imports).

- [ ] **Step 7: Commit**

```bash
git add src/store/assetStore.ts src/components/outputs/GanttPanel.tsx src/store/__tests__/assetStore.test.ts
git commit   # "feat: wire contract-status filter into store + GanttPanel" + required trailers
```

---

### Task 3: Interactive legend (FilterPanel) + i18n keys

Turn the static legend rows into toggle buttons and add the two new i18n keys to all four locales. Completes the feature.

**Files:**
- Modify: `src/components/inputs/FilterPanel.tsx`
- Modify: `src/i18n/locales/en.json`, `fr.json`, `it.json`, `de.json`
- Test: `src/i18n/__tests__/locales.test.ts` (create)

**Interfaces:**
- Consumes: `STATUS_ORDER` and `STATUS_COLORS` (`src/utils/colors.ts`); `filters.statuses` + `setFilters` (store, Task 2); `ContractStatus` (`src/types/asset.ts`).
- Produces: no new exports (UI + locale data).

- [ ] **Step 1: Write the failing locale-completeness test** — create `src/i18n/__tests__/locales.test.ts`:

```ts
import de from '../locales/de.json'
import en from '../locales/en.json'
import fr from '../locales/fr.json'
import it from '../locales/it.json'

const locales: Record<string, { filter: Record<string, string> }> = { en, fr, it, de }

describe('locale completeness for the legend filter', () => {
  for (const [name, dict] of Object.entries(locales)) {
    it(`${name} defines filter.legend and filter.showAll`, () => {
      expect(dict.filter.legend).toBeTruthy()
      expect(dict.filter.showAll).toBeTruthy()
    })
  }
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/i18n/__tests__/locales.test.ts`
Expected: FAIL — `filter.legend` / `filter.showAll` are `undefined` in all four locales.

- [ ] **Step 3: Add the two keys to each locale's `filter` object**

In each file, add `legend` and `showAll` to the existing `filter` object (e.g. after its `clear` entry), matching the file's existing indentation:

- `src/i18n/locales/en.json` → `"legend": "Legend", "showAll": "Show all"`
- `src/i18n/locales/fr.json` → `"legend": "Légende", "showAll": "Tout afficher"`
- `src/i18n/locales/it.json` → `"legend": "Legenda", "showAll": "Mostra tutto"`
- `src/i18n/locales/de.json` → `"legend": "Legende", "showAll": "Alle anzeigen"`

- [ ] **Step 4: Run the locale test to verify it passes**

Run: `npx vitest run src/i18n/__tests__/locales.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Make the legend interactive** — in `src/components/inputs/FilterPanel.tsx`:

Update the colors import (line 3) to also bring in `STATUS_ORDER`:
```ts
import { STATUS_COLORS, STATUS_ORDER } from '@utils/colors'
```

Replace the inline `statuses` array (lines 19-24) with a `STATUS_ORDER`-driven list plus a toggle handler:
```ts
  const statusItems = STATUS_ORDER.map((status) => ({ status, label: t(`status.${status}`) }))

  const toggleStatus = (s: ContractStatus) => {
    const cur = filters.statuses
    setFilters({ statuses: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] })
  }
```

Replace the whole `{/* Legend */}` block (lines 79-95) with an interactive version:
```tsx
      {/* Legend — click a row to show/hide that status bucket */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('filter.legend')}
          </p>
          {filters.statuses.length < STATUS_ORDER.length && (
            <button
              type="button"
              onClick={() => setFilters({ statuses: [...STATUS_ORDER] })}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {t('filter.showAll')}
            </button>
          )}
        </div>
        <div className="space-y-1">
          {statusItems.map(({ status, label }) => {
            const visible = filters.statuses.includes(status)
            return (
              <button
                key={status}
                type="button"
                aria-pressed={visible}
                onClick={() => toggleStatus(status)}
                className={`flex w-full items-center gap-2 text-xs ${
                  visible
                    ? 'text-gray-600 dark:text-gray-300'
                    : 'text-gray-400 line-through opacity-50 dark:text-gray-500'
                }`}
              >
                <span
                  className="inline-block h-3 w-3 flex-shrink-0 rounded-sm"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                />
                {label}
              </button>
            )
          })}
        </div>
      </div>
```

(`ContractStatus` is already imported in `FilterPanel.tsx` at line 4; `filters`/`setFilters` already destructured from the store at line 8.)

- [ ] **Step 6: Full CI gate**

Run: `make ci`
Expected: typecheck + lint + test-coverage (≥75% on engines/utils) + build all pass.

- [ ] **Step 7: Manual smoke check**

Run: `make dev`, open `http://localhost:5173/360gantt/`, load any CSV (e.g. `~/Library/CloudStorage/OneDrive-Home/assets (7).csv`). Verify:
- All four legend rows are clickable; clicking "Expired" hides expired (gray) bars and dims/strikes that legend row; clicking again restores them.
- "Show all" appears when any bucket is hidden and restores all four.
- Status filter composes with location + search filters.
- Toggling all four off yields an empty chart.

- [ ] **Step 8: Commit**

```bash
git add src/components/inputs/FilterPanel.tsx src/i18n/locales/*.json src/i18n/__tests__/locales.test.ts
git commit   # "feat: interactive legend toggles contract-status filter" + required trailers
```

---

## Verification (end-to-end)

- [ ] `make ci` passes (typecheck, Biome, Vitest coverage ≥75% on engines/utils, build).
- [ ] Manual smoke per Task 3 Step 7 (the one thing automation can't cover — legend interaction, dimming, empty state).

## Self-Review (completed during planning)

- **Spec coverage:** Decision 1 (4 buckets) → `STATUS_ORDER` + legend maps it (Tasks 1, 3). Decision 2 (classic toggle, default all) → store default `[...STATUS_ORDER]` + `toggleStatus` (Tasks 2, 3). Decision 3 (hide not dim) → `filterGroupsByStatus` prunes + dimmed legend row (Tasks 1, 3). Decision 4 (all-hidden = empty) → helper returns `[]` for empty `statuses` (Task 1, tested). Decision 5 (composition) → GanttPanel pipeline ANDs location → status → search (Task 2). Store field, engine helper, GanttPanel wiring, interactive legend, i18n (4 locales) all have tasks. Spec's "reset on data load" note resolved: `setData` does not reset filters; default lives in `initialState` and is restored by `reset()`.
- **Placeholders:** none — every code step shows full content.
- **Type consistency:** `STATUS_ORDER: ContractStatus[]` and `filterGroupsByStatus(groups, statuses)` defined in Task 1 are consumed with identical names/types in Tasks 2-3; `Filters.statuses: ContractStatus[]` defined in Task 2 is read in Task 3; `STATUS_ORDER.length` used for the bucket count everywhere (no literal `4`).
