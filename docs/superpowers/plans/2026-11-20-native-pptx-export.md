# Native PPTX Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-screenshot PPTX export with a native-shape deck (title, overview, one slide per location with real bars) in the vsizer "Midnight Executive" style, shared by the browser and the `360gantt` CLI.

**Architecture:** A pure planner (`planDeck`) turns filtered `LocationGroup[]` into slide plans; a renderer (`buildPptx`) draws them with `pptxgenjs` shapes. Browser hook and CLI both call `buildPptx`. The CSV pipeline, web chart colours and other exports are untouched.

**Tech Stack:** TypeScript strict, `pptxgenjs ^4.0.1` (already a dependency), Vitest globals, Biome.

**Spec:** `docs/superpowers/specs/2026-11-20-native-pptx-export-design.md`

## Global Constraints

- No new dependency; stay on `pptxgenjs ^4.0.1`.
- Slide size 13.333 × 7.5 in (`LAYOUT_WIDE`); font `Calibri`; hex colours without `#`.
- Palette: navy `1E2761`, ice `CADCFC`, gold `F9B935`, darkText `21295C`, grey `6B7291`, lightBg `F5F7FC`, green `2E8B57`, orange `E07B00`, red `C0392B`.
- Bar colour by `contractStatus()`: ok → green, warning → orange, critical → red, expired → grey. Web `contractStatusColor` / `STATUS_COLORS` unchanged.
- Factual text only: no taglines or recommendations. English strings, kept in one object.
- New engine code lives in `src/engines/export/pptx/` (covered by the ≥75 % gate); each new file gets tests.
- Biome is the only linter; `as any` not allowed; vitest globals (no imports of `describe`/`it`/`expect`).
- Path aliases: `@/`, `@engines/`, `@store/`, `@utils/`, `@hooks/`.

## Review Focus

- Empty selection (filters remove everything) → `buildPptx` throws `Error('Nothing to export')`, the hook toasts it, no file written.
- A location with more rows than fit on one slide → continuation slides titled `"<name> (continued)"`, no row lost or duplicated.
- Expired asset whose `barEnd` is later than `contractEnd` (end-of-support extension) → bar reaches `barEnd`.
- Bar narrower than 0.03 in (install date ≈ end date) → drawn at minimum width 0.03 in, never zero or negative.
- "Today" outside the axis range → no today line drawn, no crash.
- Very long product name → label truncated to 44 chars with `…`, no overflow.

---

### Task 1: Theme, status colour and time axis

**Files:**
- Create: `src/engines/export/pptx/theme.ts`
- Create: `src/engines/export/pptx/axis.ts`
- Test: `src/engines/export/pptx/__tests__/theme.test.ts`, `src/engines/export/pptx/__tests__/axis.test.ts`

**Interfaces:**
- Produces:
  - `THEME` (const object with the palette keys above, camelCase: `navy, ice, gold, darkText, grey, lightBg, green, orange, red, white`), `SLIDE_W = 13.333`, `SLIDE_H = 7.5`, `FONT = 'Calibri'`
  - `statusColor(status: ContractStatus): string`
  - `interface Axis { start: Date; end: Date; ticks: { label: string; date: Date }[] }`
  - `buildAxis(groups: LocationGroup[]): Axis`
  - `dateToFraction(date: Date, axis: Axis): number` (0..1, unclamped)

- [ ] **Step 1: Write failing tests**
  - `theme.test.ts`: `statusColor('ok') === '2E8B57'`, `'warning' → 'E07B00'`, `'critical' → 'C0392B'`, `'expired' → '6B7291'`.
  - `axis.test.ts` with a group spanning 2024-03-10 → 2026-06-01: `axis.start` is `2024-01-01`, `axis.end` is `2027-01-01`; span ≤ 3 years → ticks are quarters labelled `"Q1 2024"`… (first tick) ; a group spanning 2020 → 2030 → ticks are years labelled `"2020"`…; `dateToFraction(axis.start, axis) === 0`, `dateToFraction(axis.end, axis) === 1`.
- [ ] **Step 2: Run** `npx vitest run src/engines/export/pptx/__tests__` → FAIL (modules missing).
- [ ] **Step 3: Implement** both files. `buildAxis` takes min `locationStart` and max `locationEnd`, aligns start down to Jan 1 and end up to the next Jan 1; quarter ticks when the aligned span is ≤ 3 years, else year ticks.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(pptx): add Midnight Executive theme, status colour and axis`.

### Task 2: Deck planner

**Files:**
- Create: `src/engines/export/pptx/plan.ts`
- Test: `src/engines/export/pptx/__tests__/plan.test.ts`

**Interfaces:**
- Consumes: `LocationGroup`, `ParsedAsset` from `@/types/asset`; `contractStatus` from `@/utils/colors`; `buildAxis`, `Axis` (Task 1).
- Produces:
  - `type RowPlan = { kind: 'group'; label: string } | { kind: 'asset'; label: string; asset: ParsedAsset }`
  - `interface LocationSlidePlan { title: string; subtitle: string; rows: RowPlan[] }`
  - `interface OverviewRow { location: string; ok: number; warning: number; critical: number; expired: number; total: number }`
  - `interface DeckPlan { totals: { locations: number; assets: number; underOneYear: number; expired: number }; overview: OverviewRow[]; slides: LocationSlidePlan[]; axis: Axis }`
  - `planDeck(groups: LocationGroup[], rowsPerSlide = 14): DeckPlan` — throws `Error('Nothing to export')` when `groups` is empty. Location title = `[locationName, city, country].filter(Boolean).join(', ')`; subtitle = `"<n> assets"`. Row labels truncated to 44 chars with `…`. A product group contributes one `group` row (`"<product> (<count>)"` when count > 1) then one `asset` row per asset (`assetId`). Rows never split a group header from its first asset; continuation slides get title suffix `" (continued)"`. `underOneYear` counts `critical`.

- [ ] **Step 1: Write failing tests** (build `LocationGroup` fixtures inline): empty input throws `'Nothing to export'`; totals and overview counts for a 2-location fixture (one expired, one critical, one ok asset); 20 asset rows with `rowsPerSlide = 14` → 2 slides, second titled `"<name> (continued)"`, total asset rows across slides equals 20; a 60-char product name → label length 44 ending in `…`.
- [ ] **Step 2: Run** `npx vitest run src/engines/export/pptx/__tests__/plan.test.ts` → FAIL.
- [ ] **Step 3: Implement** `planDeck` as a pure function; the pagination rule above is the only non-obvious part.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(pptx): plan deck slides from location groups`.

### Task 3: Slide renderer and `buildPptx`

**Files:**
- Create: `src/engines/export/pptx/strings.ts`, `src/engines/export/pptx/slides.ts`, `src/engines/export/pptx/index.ts`
- Test: `src/engines/export/pptx/__tests__/build.test.ts`

**Interfaces:**
- Consumes: `planDeck`, `DeckPlan` (Task 2); `THEME`, `SLIDE_W`, `SLIDE_H`, `FONT`, `statusColor` (Task 1); `dateToFraction`, `Axis`.
- Produces:
  - `PPTX_STRINGS` (const: deck title, eyebrow `"ASSET LIFECYCLE — CONTRACT COVERAGE"`, KPI labels `Locations / Assets / Expiring < 1 year / Expired`, overview headers, legend labels `> 2 years / 1–2 years / < 1 year / Expired`, `Today`)
  - `interface BuildPptxInput { groups: LocationGroup[]; sourceName: string; generatedOn?: Date }`
  - `buildPptx(input: BuildPptxInput): Promise<ArrayBuffer>` (re-exported from `index.ts`)
  - `slides.ts` exports `addTitleSlide`, `addOverviewSlide`, `addLocationSlide`, each `(pptx: PptxGenJS, plan: DeckPlan, …) => void`.

Layout (inches): title slide as vsizer — full navy rect, gold strip `y 6.75, h 0.18`, eyebrow gold 14 pt at `(0.7, 0.7)`, title white 40 pt at `(0.7, 1.4)`, subtitle ice `"<sourceName> · <yyyy-mm-dd>"`, four KPI tiles at the bottom. Location slide: light header band with title (navy, 24 pt) and subtitle (grey); label column `x 0.5 → 4.1`; chart area `x 4.3 → 12.8`; axis tick labels at top with hairline vertical gridlines; group rows bold darkText on lightBg; asset rows one bar each, `h 0.22`, colour `statusColor(contractStatus(asset.daysRemaining))`, bar spans `dateToFraction(installDate)` → `dateToFraction(barEnd)` clamped to the chart area and at least 0.03 in wide; today line in gold with `Today` label only when 0 ≤ fraction ≤ 1; legend with four coloured squares at the bottom. Overview slide: `addTable`, header fill navy / white text, alternate rows lightBg.

- [ ] **Step 1: Write failing tests** in `build.test.ts`: `buildPptx` on a 3-asset fixture resolves to an `ArrayBuffer` with `byteLength > 0` whose first two bytes are `0x50 0x4b` (zip); `buildPptx({ groups: [] })` rejects with `'Nothing to export'`; an asset with `installDate === barEnd` and an asset whose today-date is outside the axis (all dates in 2010) both build without throwing.
- [ ] **Step 2: Run** `npx vitest run src/engines/export/pptx/__tests__/build.test.ts` → FAIL.
- [ ] **Step 3: Implement** `slides.ts` per the layout above and `buildPptx` as: `planDeck` → `new PptxGenJS()` with `layout = 'LAYOUT_WIDE'`, `title` from strings → add title, overview, each location slide → `pptx.write({ outputType: 'arraybuffer' })`.
- [ ] **Step 4: Run** → PASS; also run `make typecheck lint`.
- [ ] **Step 5: Commit** `feat(pptx): render native-shape deck`.

### Task 4: Filter selection helper and browser wiring

**Files:**
- Create: `src/engines/csv/selectGroups.ts`
- Test: `src/engines/csv/__tests__/selectGroups.test.ts`
- Modify: `src/hooks/useExport.ts` (`exportPptx`, imports)

**Interfaces:**
- Consumes: `Filters` from `@store/assetStore`; `filterGroupsByStatus` (`./statusFilter`); `groupAssets` (`./assetGrouper`); `buildPptx` (Task 3).
- Produces: `selectGroups(groups: LocationGroup[], filters: Filters): LocationGroup[]` — mirrors `GanttPanel` exactly: location filter (empty = all) → `filterGroupsByStatus` → search: keep assets whose `` `${productName} (${assetId})` `` lower-cased contains `filters.search.toLowerCase()`, regroup with `groupAssets`; if the search leaves nothing, return the pre-search result (same fallback as the chart).

- [ ] **Step 1: Write failing tests**: empty filters returns input unchanged; `locationIds` restricts; `statuses: ['expired']` keeps only expired assets; `search` matching one asset keeps only it; `search` matching nothing returns the pre-search groups.
- [ ] **Step 2: Run** `npx vitest run src/engines/csv/__tests__/selectGroups.test.ts` → FAIL.
- [ ] **Step 3: Implement** `selectGroups`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Rewire `exportPptx` in `useExport.ts`**: read `locationGroups` and `filters` from `useAssetStore.getState()`, call `buildPptx({ groups: selectGroups(locationGroups, filters), sourceName: '360gantt' })`, download via Blob + anchor named `360gantt-export.pptx`, same toast pattern as the other exports (loading → success / error with the thrown message). `exportPptx` no longer needs `ganttRef` or `captureElement`; delete the now-unused `pptxgenjs` import. Run `make typecheck lint`.
- [ ] **Step 6: Commit** `feat(pptx): export native deck from the browser`.

### Task 5: CLI wiring, cleanup and docs

**Files:**
- Modify: `src/cli/exporters.ts` (`ExportInput`, `writeExport`, remove `writePptx`, `PptxGenJS` import), `src/cli/index.ts`, `src/cli/__tests__/exporters.test.ts`, `src/cli/__tests__/export.e2e.test.ts`, `README.md:27`, `CLAUDE.md` (Export section)

**Interfaces:**
- Consumes: `buildPptx` (Task 3); `ParseResult.locationGroups`.
- Produces: `ExportInput` gains `groups: LocationGroup[]`; the `'pptx'` case writes `Buffer.from(await buildPptx({ groups: input.groups, sourceName: basename(inputPath) }))` — add `sourceName: string` to `ExportInput` too, set by `index.ts` from the CSV file's basename.

- [ ] **Step 1: Update tests first**: add `groups` and `sourceName` to the `ExportInput` objects in both CLI tests (e2e uses `locationGroups` from `parseCsvToGantt`); in the e2e test also assert the `.pptx` file's first two bytes are `PK` (zip) and its size is `> 0`.
- [ ] **Step 2: Run** `npx vitest run src/cli` → FAIL (type/shape).
- [ ] **Step 3: Implement** the `ExportInput` change, replace the `pptx` branch, delete `writePptx`, and pass `groups: locationGroups` and `sourceName` from `index.ts`.
- [ ] **Step 4: Run** `make ci` → typecheck, lint, tests with ≥75 % coverage, and build all pass.
- [ ] **Step 5: Docs**: README line 27 becomes "**Export to PPTX** — native-shape deck (title, overview, one slide per location) in the Midnight Executive style"; replace the CLAUDE.md Export section's PPTX mention to point at `src/engines/export/pptx/` and add `src/engines/export/pptx/` to the engine-layer list.
- [ ] **Step 6: Manual check**: `npm run build:cli` then `node dist-cli/index.js tests/fixtures/sample-assets.csv -o <scratchpad dir>/check.pptx` (a temp dir, not the repo); open the file and confirm title, overview and location slides look right (report what you saw).
- [ ] **Step 7: Commit** `feat(pptx): use native deck in the CLI and update docs`.
