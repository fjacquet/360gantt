# Expired Asset Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show all hardware assets in the Gantt regardless of service-contract status, and draw each bar to its next actionable deadline (contract end while live, end-of-standard-support once lapsed).

**Architecture:** Three sequential, independently-green changes to the pure CSV engine layer: (1) relax the `Active`-only filter; (2) add `endOfSupport`/`barEnd` to `ParsedAsset` and compute them; (3) consume `barEnd` in the SVAR adapter and grouper span while preserving the existing contract-end-based sort order. No React, store, or component changes; color logic is reused unchanged.

**Tech Stack:** TypeScript (strict), Vitest (globals, no explicit imports), Biome (sole linter/formatter), React + SVAR Gantt (downstream consumers, untouched here).

**Context / why:** A user's CSV has 14 VxRail hardware rows but only 2 reach the Gantt. Root cause: `isIncluded()` (`src/engines/csv/assetFilter.ts:39-40`) drops any row whose `SERVICES STATUS` isn't `Active`; 12 of the 14 are `Ended` (contracts lapsed Feb 1 2026). Lapsed-contract hardware is the highest-risk category and was hidden. See spec: `docs/superpowers/specs/2026-06-24-expired-asset-visibility-design.md`.

**Branch:** Work continues on `feat/expired-asset-visibility` (already checked out; spec already committed there).

## Global Constraints

- **Coverage threshold:** Vitest enforces ≥ 75% lines/functions/branches/statements on the engine layer; `make test-coverage` must pass. Copied verbatim from CLAUDE.md.
- **Biome only:** no ESLint. Suppress with `// biome-ignore lint/<rule>: <reason>` if ever needed.
- **TypeScript strict mode:** no new `as any` (the only sanctioned one is the `CSSStyleDeclaration.zoom` property in `useExport.ts`, unrelated to this work).
- **Tests use Vitest globals:** do NOT import `describe`/`it`/`expect`.
- **Engine layer is pure functions, no React imports.**
- **Every commit message must end with these two trailers** (verbatim):
  ```text
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PwjvYFwpYKQ3NvfnZtHtn2
  ```
- **Single-file test run:** `npx vitest run <path>`. Full gate: `make ci` (typecheck + lint + test-coverage + build).

---

### Task 1: Relax the status filter (show all hardware regardless of contract status)

Drop the `SERVICES STATUS = Active` gate in `isIncluded()`. Keep the hardware-only gate and the parseable-date requirement. This alone makes lapsed assets appear (bars at contract end, auto-colored gray by the existing `daysRemaining < 0` branch).

**Files:**
- Modify: `src/engines/csv/assetFilter.ts` (import line 1; `isIncluded` lines 35-45)
- Test: `src/engines/csv/__tests__/assetFilter.test.ts` (update lines 28-30 and 135-145)

**Interfaces:**
- Consumes: `HARDWARE_VALUES`, `type FieldMap` from `./headerResolver`; `parseContractDate` from `./dateParser`.
- Produces: `isIncluded(raw: RawAsset): boolean` — unchanged signature; now returns `true` for hardware rows with a parseable date regardless of `servicesStatus`. `ACTIVE_VALUES` is no longer imported or referenced.

- [ ] **Step 1: Update the failing tests in `assetFilter.test.ts`**

Replace the existing `'excludes non-active status'` test (lines 28-30) with:

```ts
  it('includes non-active (ended) hardware', () => {
    expect(isIncluded({ ...baseAsset, servicesStatus: 'Ended' })).toBe(true)
  })
```

Replace the `filterAssets` test `'returns only parseable hardware/active assets'` (lines 136-145) with:

```ts
  it('returns all parseable hardware assets regardless of status', () => {
    const raws: RawAsset[] = [
      { ...baseAsset, assetId: 'KEEP' },
      { ...baseAsset, assetId: 'SKIP_SW', productType: 'SOFTWARE' },
      { ...baseAsset, assetId: 'ENDED', servicesStatus: 'Ended' },
    ]
    const parsed = filterAssets(raws)
    expect(parsed).toHaveLength(2)
    expect(parsed.map((p) => p.assetId).sort()).toEqual(['ENDED', 'KEEP'])
  })
```

Leave the other tests (`excludes software assets`, `excludes missing contract end date`, `includes French active status (Actif)`) unchanged — they still pass.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engines/csv/__tests__/assetFilter.test.ts`
Expected: FAIL — `includes non-active (ended) hardware` expects `true` but current code returns `false`; the `filterAssets` test expects length 2 but gets 1.

- [ ] **Step 3: Implement — drop the status gate**

In `src/engines/csv/assetFilter.ts`, change the import on line 1 from:

```ts
import { ACTIVE_VALUES, HARDWARE_VALUES, type FieldMap } from './headerResolver'
```
to:
```ts
import { HARDWARE_VALUES, type FieldMap } from './headerResolver'
```

Replace the body of `isIncluded` (lines 35-45) with:

```ts
export function isIncluded(raw: RawAsset): boolean {
  const typeUpper = raw.productType.toUpperCase()
  if (!HARDWARE_VALUES.some((v) => v.toUpperCase() === typeUpper)) return false

  const contractEnd =
    parseContractDate(raw.contractEndDate) ?? parseContractDate(raw.endOfStandardSupport)
  return contractEnd !== null
}
```

Also update the JSDoc above `isIncluded` (lines 29-34): remove the `services status is Active` bullet.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engines/csv/__tests__/assetFilter.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Verify lint + typecheck clean (catches the removed import)**

Run: `make lint && make typecheck`
Expected: no errors (confirms `ACTIVE_VALUES` is no longer referenced).

- [ ] **Step 6: Commit**

```bash
git add src/engines/csv/assetFilter.ts src/engines/csv/__tests__/assetFilter.test.ts
git commit  # message: "feat: show all hardware assets regardless of contract status" + required trailers
```

---

### Task 2: Add `endOfSupport` and `barEnd` to `ParsedAsset`

Introduce the data the rendering layer needs: the parsed end-of-standard-support date and the computed bar-end date (`contractEnd` while live; `endOfSupport ?? contractEnd` once lapsed). Adding these as **required** fields forces updates to the two test helpers that build `ParsedAsset` literals, so they stay compiling/green.

**Files:**
- Modify: `src/types/asset.ts` (`ParsedAsset` interface, lines 17-28)
- Modify: `src/engines/csv/assetFilter.ts` (`toParsedAsset`, lines 51-73)
- Test: `src/engines/csv/__tests__/assetFilter.test.ts` (add a `barEnd / endOfSupport` describe block)
- Test helper: `src/engines/csv/__tests__/assetGrouper.test.ts` (`makeAsset`, lines 4-17)
- Test helper: `src/engines/csv/__tests__/svarAdapter.test.ts` (`makeLocationGroup` asset literal, lines 18-28)

**Interfaces:**
- Produces on `ParsedAsset`:
  - `endOfSupport: Date | null` — parsed `END OF STANDARD SUPPORT`, or `null` when absent/unparseable.
  - `barEnd: Date` — `daysRemaining < 0 ? (endOfSupport ?? contractEnd) : contractEnd`.
- Consumed by Task 3 (`svarAdapter`, `assetGrouper`).

- [ ] **Step 1: Write the failing tests** (append to `assetFilter.test.ts`)

```ts
describe('barEnd / endOfSupport', () => {
  const today = new Date(2025, 0, 1)

  it('uses contractEnd as barEnd for a live contract', () => {
    const parsed = toParsedAsset(
      { ...baseAsset, contractEndDate: 'December 31, 2027', endOfStandardSupport: 'June 30, 2030' },
      today,
    )
    expect(parsed.barEnd.getTime()).toBe(parsed.contractEnd.getTime())
    expect(parsed.endOfSupport?.getFullYear()).toBe(2030)
  })

  it('extends barEnd to endOfSupport for an expired contract', () => {
    const parsed = toParsedAsset(
      { ...baseAsset, contractEndDate: 'February 01, 2020', endOfStandardSupport: 'June 30, 2030' },
      today,
    )
    expect(parsed.daysRemaining).toBeLessThan(0)
    expect(parsed.barEnd.getFullYear()).toBe(2030)
  })

  it('falls back to contractEnd as barEnd when an expired contract has no endOfSupport', () => {
    const parsed = toParsedAsset(
      { ...baseAsset, contractEndDate: 'February 01, 2020', endOfStandardSupport: '' },
      today,
    )
    expect(parsed.endOfSupport).toBeNull()
    expect(parsed.barEnd.getTime()).toBe(parsed.contractEnd.getTime())
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/engines/csv/__tests__/assetFilter.test.ts`
Expected: FAIL — `parsed.barEnd` / `parsed.endOfSupport` are `undefined` (and TypeScript errors that the properties don't exist on `ParsedAsset`).

- [ ] **Step 3: Add the fields to `ParsedAsset`** in `src/types/asset.ts`

Insert after the `daysRemaining` field (after line 27):

```ts
  /** Parsed END OF STANDARD SUPPORT date, or null if absent/unparseable */
  endOfSupport: Date | null
  /** Bar end date: contractEnd while the contract is live, else endOfSupport ?? contractEnd */
  barEnd: Date
```

- [ ] **Step 4: Compute the fields in `toParsedAsset`** (`src/engines/csv/assetFilter.ts`)

In `toParsedAsset`, after the `daysRemaining` calculation (after line 60) and before the `return`, add:

```ts
  const endOfSupport = parseContractDate(raw.endOfStandardSupport)
  const barEnd = daysRemaining < 0 ? (endOfSupport ?? contractEnd) : contractEnd
```

Add the two new fields to the returned object (after `daysRemaining,`):

```ts
    daysRemaining,
    endOfSupport,
    barEnd,
```

- [ ] **Step 5: Update the `makeAsset` helper** in `src/engines/csv/__tests__/assetGrouper.test.ts` so `barEnd` defaults to `contractEnd` (keeps existing grouper assertions valid after Task 3). Replace the function (lines 4-17) with:

```ts
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
```

- [ ] **Step 6: Update the asset literal** in `src/engines/csv/__tests__/svarAdapter.test.ts` `makeLocationGroup` (the object at lines 18-28). Add the two fields after `daysRemaining: 730,`:

```ts
            daysRemaining: 730,
            endOfSupport: null,
            barEnd: new Date(2027, 0, 1),
```

- [ ] **Step 7: Run the affected test files to verify green**

Run: `npx vitest run src/engines/csv/__tests__/assetFilter.test.ts src/engines/csv/__tests__/assetGrouper.test.ts src/engines/csv/__tests__/svarAdapter.test.ts`
Expected: PASS (all three files; the new `barEnd / endOfSupport` tests pass, existing tests unchanged).

- [ ] **Step 8: Typecheck**

Run: `make typecheck`
Expected: no errors (all `ParsedAsset` literals now include the required fields).

- [ ] **Step 9: Commit**

```bash
git add src/types/asset.ts src/engines/csv/assetFilter.ts \
  src/engines/csv/__tests__/assetFilter.test.ts \
  src/engines/csv/__tests__/assetGrouper.test.ts \
  src/engines/csv/__tests__/svarAdapter.test.ts
git commit  # message: "feat: compute barEnd/endOfSupport on ParsedAsset" + required trailers
```

---

### Task 3: Draw `barEnd` in the adapter and extend the grouper span (sort still by contract end)

Make the visible bars and summary spans use `barEnd`, while keeping the "most-urgent-first" ordering driven by contract-end dates (so overdue/expired groups stay at the top, not buried by their 2030 end-of-support span).

**Files:**
- Modify: `src/engines/csv/svarAdapter.ts` (asset-task push, line ~54)
- Modify: `src/engines/csv/assetGrouper.ts` (full `groupAssets` rewrite of span + sort lines)
- Modify: `src/types/asset.ts` (doc comments on `groupEnd` / `locationEnd`)
- Test: `src/engines/csv/__tests__/svarAdapter.test.ts` (add a barEnd assertion test)
- Test: `src/engines/csv/__tests__/assetGrouper.test.ts` (add span-vs-sort tests)

**Interfaces:**
- Consumes: `ParsedAsset.barEnd`, `ParsedAsset.contractEnd` (from Task 2).
- Produces: `groupEnd` / `locationEnd` now equal the latest child `barEnd` (span); group/location ordering is by latest `contractEnd` (urgency). `toGanttData` leaf task `end` equals `asset.barEnd`.

- [ ] **Step 1: Write the failing adapter test** — append to `svarAdapter.test.ts`:

```ts
  it('uses barEnd (not contractEnd) for the asset bar end', () => {
    const group: LocationGroup = {
      locationId: 'L1',
      locationName: 'Main DC',
      city: 'Geneva',
      country: 'Switzerland',
      locationStart: new Date(2022, 0, 1),
      locationEnd: new Date(2030, 0, 1),
      productGroups: [
        {
          productName: 'VxRail E660F',
          groupStart: new Date(2022, 0, 1),
          groupEnd: new Date(2030, 0, 1),
          assets: [
            {
              assetId: 'EXP',
              productName: 'VxRail E660F',
              locationId: 'L1',
              locationName: 'Main DC',
              city: 'Geneva',
              country: 'Switzerland',
              installDate: new Date(2022, 0, 1),
              contractEnd: new Date(2024, 0, 1),
              daysRemaining: -100,
              endOfSupport: new Date(2030, 0, 1),
              barEnd: new Date(2030, 0, 1),
            },
          ],
        },
      ],
    }
    const data = toGanttData([group])
    const leaf = data.tasks.find((t) => t.type === 'task')
    expect(leaf?.end?.getFullYear()).toBe(2030)
  })
```

- [ ] **Step 2: Write the failing grouper tests** — append to `assetGrouper.test.ts`:

```ts
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
```

- [ ] **Step 3: Run both test files to verify they fail**

Run: `npx vitest run src/engines/csv/__tests__/svarAdapter.test.ts src/engines/csv/__tests__/assetGrouper.test.ts`
Expected: FAIL — adapter leaf `end` is still `contractEnd` (2024, not 2030); `groupEnd`/`locationEnd` still `contractEnd`-based (2024); the sort test may already pass but the span tests fail.

- [ ] **Step 4: Draw `barEnd` in `svarAdapter.ts`**

In the asset loop (lines 47-58), change the leaf task's `end` from `asset.contractEnd` to `asset.barEnd`:

```ts
      for (const asset of group.assets) {
        const color = contractStatusColor(asset.daysRemaining)
        tasks.push({
          id: idCounter++,
          text: `${asset.productName} (${asset.assetId})`,
          start: asset.installDate,
          end: asset.barEnd,
          type: 'task',
          parent: productId,
          color,
        })
      }
```

- [ ] **Step 5: Rewrite `groupAssets`** in `src/engines/csv/assetGrouper.ts` — span uses `barEnd`, sort uses `contractEnd`. Replace the whole file body (keep the existing import line) with:

```ts
import type { LocationGroup, ParsedAsset, ProductGroup } from '@/types/asset'

/** Latest of a list of dates (defaults to now for an empty list). */
function latest(dates: Date[]): Date {
  return dates.reduce((max, d) => (d > max ? d : max), dates[0] ?? new Date())
}

/** Earliest of a list of dates (defaults to now for an empty list). */
function earliest(dates: Date[]): Date {
  return dates.reduce((min, d) => (d < min ? d : min), dates[0] ?? new Date())
}

/**
 * Groups parsed assets by locationId → productName.
 * Summary spans (groupEnd / locationEnd) extend to the latest child barEnd,
 * but ordering stays driven by contract end (soonest first) so the most
 * urgent items — including overdue/expired contracts — appear at the top.
 */
export function groupAssets(assets: ParsedAsset[]): LocationGroup[] {
  const locationMap = new Map<string, Map<string, ParsedAsset[]>>()

  for (const asset of assets) {
    let productMap = locationMap.get(asset.locationId)
    if (!productMap) {
      productMap = new Map()
      locationMap.set(asset.locationId, productMap)
    }
    const existing = productMap.get(asset.productName) ?? []
    existing.push(asset)
    productMap.set(asset.productName, existing)
  }

  const locationGroups: LocationGroup[] = []

  for (const [locationId, productMap] of locationMap) {
    const productGroups: ProductGroup[] = []

    for (const [productName, productAssets] of productMap) {
      // Sort assets within a product group by contract end (soonest first)
      productAssets.sort((a, b) => a.contractEnd.getTime() - b.contractEnd.getTime())

      const groupStart = earliest(productAssets.map((a) => a.installDate))
      // Span extends to the latest bar end (end-of-support for expired assets)
      const groupEnd = latest(productAssets.map((a) => a.barEnd))

      productGroups.push({ productName, assets: productAssets, groupStart, groupEnd })
    }

    // Order product groups by urgency: latest contract end (NOT barEnd), soonest first
    productGroups.sort(
      (a, b) =>
        latest(a.assets.map((x) => x.contractEnd)).getTime() -
        latest(b.assets.map((x) => x.contractEnd)).getTime(),
    )

    const representative = assets.find((a) => a.locationId === locationId)
    const locationStart = earliest(productGroups.map((g) => g.groupStart))
    const locationEnd = latest(productGroups.map((g) => g.groupEnd))

    locationGroups.push({
      locationId,
      locationName: representative?.locationName ?? locationId,
      city: representative?.city ?? '',
      country: representative?.country ?? '',
      productGroups,
      locationStart,
      locationEnd,
    })
  }

  // Order locations by urgency: latest contract end (NOT barEnd), soonest first
  locationGroups.sort(
    (a, b) =>
      latest(a.productGroups.flatMap((g) => g.assets.map((x) => x.contractEnd))).getTime() -
      latest(b.productGroups.flatMap((g) => g.assets.map((x) => x.contractEnd))).getTime(),
  )

  return locationGroups
}
```

- [ ] **Step 6: Update doc comments** in `src/types/asset.ts` — change the `groupEnd` comment (line 36-37) to `/** Latest bar end across all assets in this group (extends to end-of-support for expired) */` and the `locationEnd` comment (line 49-50) to `/** Latest bar end across all products in this location */`.

- [ ] **Step 7: Run both test files to verify they pass**

Run: `npx vitest run src/engines/csv/__tests__/svarAdapter.test.ts src/engines/csv/__tests__/assetGrouper.test.ts`
Expected: PASS — including the unchanged grouper tests (`computes groupStart…`, `sorts locations by end date…`, `computes locationStart/End…`), which stay green because `makeAsset` now defaults `barEnd` to `contractEnd`.

- [ ] **Step 8: Full CI gate**

Run: `make ci`
Expected: typecheck + lint + test-coverage (≥75%) + build all pass.

- [ ] **Step 9: Commit**

```bash
git add src/engines/csv/svarAdapter.ts src/engines/csv/assetGrouper.ts src/types/asset.ts \
  src/engines/csv/__tests__/svarAdapter.test.ts src/engines/csv/__tests__/assetGrouper.test.ts
git commit  # message: "feat: draw bars to end-of-support for expired assets" + required trailers
```

---

## Verification (end-to-end)

- [ ] **Automated:** `make ci` passes (typecheck, Biome lint, Vitest coverage ≥75%, build).
- [ ] **Manual, with the real CSV** that surfaced the bug:
  1. `make dev`, open `http://localhost:5173/360gantt/`.
  2. Load `~/Library/CloudStorage/OneDrive-Home/assets (7).csv`.
  3. Confirm the Lausanne `F.H.V.I.` location now shows **9** VxRail E660F rows (1 blue active → Feb 2028, 8 gray expired → Jun 2030) and the Prilly location shows **5** (1 active, 4 expired) — previously only 1 each.
  4. Confirm gray (expired) bars extend to mid-2030 (end of standard support) and blue (active) bars end Feb 2028.
  5. Confirm the 2 VxRail **Software** rows remain absent (hardware-only).
  6. Confirm overdue/expired groups sort toward the top (soonest contract end first).

## Self-Review (completed during planning)

- **Spec coverage:** Decision 1 (show all statuses) → Task 1. Decision 2 (bar end = next deadline) → Task 2 (compute) + Task 3 (draw). Decision 3 (date-keyed expired) → Task 2 `daysRemaining < 0`. Decision 4 (color unchanged) → no task, reused `contractStatusColor`. Decision 5 (global) → Task 1 removes the status gate for all products. Hardware-only retained → unchanged `HARDWARE_VALUES` check + verified by `pipeline.test.ts` software case. Edge cases (no EOSS; active; unparseable contract date with EOSS fallback) → Task 2 tests + fallback logic.
- **Placeholders:** none — every code step shows full content.
- **Type consistency:** `endOfSupport: Date | null` and `barEnd: Date` are defined in Task 2 and consumed with the same names/types in Task 3; `latest`/`earliest` helpers defined and used within `assetGrouper.ts`.
