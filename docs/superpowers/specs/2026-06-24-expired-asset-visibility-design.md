# Show all hardware assets; extend expired bars to end-of-support

**Date:** 2026-06-24
**Status:** Approved (design)
**Area:** CSV engine layer (`src/engines/csv/`), `src/utils/colors.ts`, `src/types/asset.ts`

## Problem

A user's CSV (`assets (7).csv`) contains 14 VxRail **hardware** rows, but only **2**
appear in the Gantt. The Lausanne location (`F.H.V.I.`, loc `10897094552`) holds 9
VxRail nodes; the user expects to see ~8 of them and sees only 1.

### Root cause

`isIncluded()` in `src/engines/csv/assetFilter.ts` (lines 39–40) drops any row whose
`SERVICES STATUS` is not in `ACTIVE_VALUES`. Of the 14 VxRail hardware rows, **12 are
`Ended`** (contracts that lapsed `February 01, 2026`) and only **2 are `Active`**
(`DE600230783159` Lausanne, `DE600230783158` Prilly — both ending `February 28, 2028`).
The two `Active` rows are exactly what renders. A further 2 VxRail rows are
`SOFTWARE` and excluded by the (retained) hardware-only filter.

This is not a parsing defect — the filter does what it was written to do. The
requirement was too narrow: lapsed-contract hardware is the highest-risk category
(already out of contract) and was being hidden.

### Data summary (from the source CSV)

| VxRail rows | PRODUCT TYPE | SERVICES STATUS | Reaches Gantt today |
| ----------- | ------------ | --------------- | ------------------- |
| 2           | HARDWARE     | Active          | yes                 |
| 12          | HARDWARE     | Ended           | no (filtered)       |
| 2           | SOFTWARE     | Active          | no (not hardware)   |

All 14 hardware rows share `END OF STANDARD SUPPORT = June 30, 2030`.

## Goal

Show **all hardware assets** regardless of service-contract status, and represent each
asset's bar so it ends on its **next actionable deadline**:

- **Live contract** → bar ends at contract end (the renew-by date).
- **Lapsed contract** → bar ends at end of standard support (the replace-by date).

Lapsed assets remain visually distinct (gray) so the chart communicates contract
status by color and replacement horizon by bar length.

## Decisions

1. **Show all statuses.** Drop the `SERVICES STATUS = Active` gate. Keep the
   `PRODUCT TYPE = HARDWARE` gate (hardware-only). Software assets remain excluded.
2. **Bar end = next actionable deadline.**
   - `daysRemaining >= 0` → `barEnd = contractEnd` (unchanged from today's behavior).
   - `daysRemaining < 0` → `barEnd = endOfSupport ?? contractEnd`.
3. **"Expired" is keyed off the date** (`daysRemaining < 0`), not the `Ended` status
   string. This matches the existing color threshold in `colors.ts` and is robust
   across the EN/FR/IT/DE status values. The `SERVICES STATUS` string is no longer
   used in filtering or display logic.
4. **Color is unchanged.** `contractStatusColor(daysRemaining)` already returns gray
   (`#9ca3af`) for `daysRemaining < 0`. Color carries contract status; bar length
   carries the replacement horizon.
5. **Filter change is global**, not VxRail-specific. The filter is product-agnostic;
   every uploaded CSV will now show lapsed hardware. The bug merely surfaced via VxRail.

## Changes

### 1. `src/engines/csv/assetFilter.ts` — `isIncluded()`

Remove the `ACTIVE_VALUES` status check. New rule:

- `PRODUCT TYPE` matches `HARDWARE_VALUES` (any language), **and**
- a parseable date exists: `parseContractDate(contractEndDate) ?? parseContractDate(endOfStandardSupport)`.

Result: all 14 VxRail hardware rows pass.

### 2. `src/types/asset.ts` — `ParsedAsset`

Add two fields:

```ts
/** Parsed END OF STANDARD SUPPORT date, or null if absent/unparseable */
endOfSupport: Date | null
/** Bar end date: contractEnd if live, else endOfSupport ?? contractEnd */
barEnd: Date
```

### 3. `src/engines/csv/assetFilter.ts` — `toParsedAsset()`

- Parse `END OF STANDARD SUPPORT` into `endOfSupport: Date | null`.
- Compute `barEnd`:
  ```ts
  const barEnd = daysRemaining < 0 ? (endOfSupport ?? contractEnd) : contractEnd
  ```
- `contractEnd` and `daysRemaining` keep their current meaning (sorting + color).

### 4. `src/engines/csv/svarAdapter.ts`

In the asset-task push (line ~54), draw `end: asset.barEnd` instead of
`asset.contractEnd`. Color stays `contractStatusColor(asset.daysRemaining)`.

### 5. `src/engines/csv/assetGrouper.ts` — separate span from sort order

- **Span:** compute `groupEnd` / `locationEnd` as the max of child `barEnd` (not
  `contractEnd`) so parent summary bars cover their extended children.
- **Sort order preserved:** continue sorting product groups and locations by their max
  `contractEnd` (the urgency date), *not* `barEnd`. This keeps the existing
  "most-urgent-first" ordering unchanged for live contracts, and lets all-expired
  groups (past `contractEnd`) rise to the top naturally. Within-group asset sort stays
  by `contractEnd` ascending.
- Update the doc comments on `groupEnd` / `locationEnd` in `src/types/asset.ts` to say
  "latest bar end" rather than "latest contract end."

### 6. `src/utils/colors.ts`

No change. The `daysRemaining < 0 → gray` branch already exists and is reused as-is.

## Visual result

- **Lausanne (`F.H.V.I.`, loc 10897094552):** 9 VxRail nodes — 1 blue (active, → Feb 28
  2028) and 8 gray (expired, → June 30 2030).
- **Prilly (loc 69761739194366):** 5 VxRail nodes — 1 active, 4 expired.
- VxRail Software rows stay excluded.

## Edge cases

- **Expired, no EOSS date:** `barEnd = contractEnd` (bar sits entirely in the past) —
  truthful "fully end-of-life."
- **Active contract:** behavior unchanged (`barEnd = contractEnd`).
- **Contract date unparseable but EOSS parseable:** row is still included via the
  fallback; `contractEnd`/`daysRemaining` derive from EOSS as today, and
  `barEnd = contractEnd` (= the EOSS fallback). Consistent.
- **`Ended` status with a future contract date (unusual):** treated as live
  (`daysRemaining >= 0`) — bar ends at contract end, not extended. Accepted: the
  date-based rule is preferred over the status string. Noted as a deliberate trade-off.

## Testing

Engine layer is pure functions with a ≥75% coverage threshold (CI-enforced).

- **Update** existing `assetFilter` tests that assert `Ended`/non-Active rows are
  excluded — they are now included when hardware + parseable date.
- **Add** cases:
  - Lapsed hardware row (`Ended`, past `contractEnd`, parseable) is **included**.
  - `barEnd` equals `endOfSupport` for an expired asset; equals `contractEnd` for a
    live asset; falls back to `contractEnd` when `endOfSupport` is absent.
  - Expired asset resolves to the gray color via `contractStatusColor`.
  - `assetGrouper` summary `groupEnd` / `locationEnd` span covers an extended child
    `barEnd`, while sort order remains driven by `contractEnd`.
- Hardware-only filter still excludes `SOFTWARE` rows.

## Out of scope (possible follow-ups)

- Color legend update explaining the gray "expired" state.
- An explicit end-of-support milestone marker on each row (show both dates).
- Including software assets.
- Surfacing `SERVICES STATUS` in a tooltip.
