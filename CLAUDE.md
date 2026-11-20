# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
make dev            # Vite dev server → http://localhost:5173/360gantt/
make build          # tsc -b && vite build (also used in CI)
make preview        # build + vite preview

make typecheck      # tsc -b (no emit)
make lint           # biome lint .
make lint-fix       # biome lint --write .
make format         # biome format --write .

make test           # vitest (watch mode)
make test-coverage  # vitest run --coverage  ← required to pass ≥75% threshold
make ci             # typecheck + lint + test-coverage + build (mirrors CI)

make docker         # docker build -t 360gantt:<version> .
make release        # git tag -a v<version> + push → triggers GitHub Release + Docker push
```

Run a single test file:
```bash
npx vitest run src/engines/csv/__tests__/headerResolver.test.ts
```

## Architecture

### Data pipeline (CSV → Gantt)

All transformation happens client-side in a linear pipeline triggered by `useCsvParse`:

```
File drop/pick
  → PapaParse (raw rows)
  → headerResolver   resolveHeaders(rawHeaders) → FieldMap
  → assetFilter      toRawAsset(row, fieldMap) → RawAsset
                     filterAssets(rawAssets)   → ParsedAsset[]
  → assetGrouper     groupAssets(parsed)        → LocationGroup[]
  → svarAdapter      toGanttData(groups)        → GanttData { tasks, links }
  → assetStore       setData(...)               → Zustand state
  → GanttPanel       reads tasks from store, renders SvgGantt (custom SVG renderer)
```

### Engine layer (`src/engines/csv/`)

Pure functions, fully unit-tested, no React dependencies.

- **headerResolver** — normalises Dell CSV column headers across EN/FR/IT/DE using `HEADER_ALIASES`. Throws if no recognised headers are found.
- **assetFilter** — keeps `PRODUCT TYPE = HARDWARE` rows that have a parseable `CONTRACT END DATE` (falling back to `END OF STANDARD SUPPORT`), **regardless of `SERVICES STATUS`** — lapsed/`Ended` contracts are shown too. Multi-language hardware matching via `HARDWARE_VALUES`. Each `ParsedAsset` also carries `endOfSupport` and `barEnd` (= `contractEnd` while live, or `endOfSupport ?? contractEnd` once expired, i.e. `daysRemaining < 0`).
- **dateParser** — handles two Dell date formats: `"July 23, 2026"` (US long form) and `"4yr, 3mo, 1d"` (age-from-today offset).
- **assetGrouper** — groups `ParsedAsset[]` by `locationId → productName`, computes `daysRemaining`, sorts by `contractEnd` ascending.
- **svarAdapter** — converts `LocationGroup[]` into the flat task array consumed by `SvgGantt` (SVAR-shaped; the name is historical). Integer IDs are assigned sequentially. Three-level hierarchy: location task (`parent` unset) → product group task (`parent=locationId`) → asset task (`parent=productId`). Bar colour set via `contractStatusColor`.

### State (`src/store/assetStore.ts`)

Single Zustand store. Key slices:
- `ganttData` / `locationGroups` — output of the pipeline
- `filters` — `{ locationIds: string[], search: string, statuses: ContractStatus[] }` — the active filter **selection** (locations, product search, and visible contract-status buckets, default all of `STATUS_ORDER`). The filtering itself is applied inside `GanttPanel` (locations + `filterGroupsByStatus` for status) and `applySearchFilter`, **not** in the store. Reset to defaults on every `setData` via `makeInitialFilters()`.
- `zoomLevel` — index into `ZOOM_PRESETS` (time-axis: 5-year/Year/Quarter/Month)
- `scaleIdx` — index into `SCALE_STEPS` (CSS zoom: 0.5× … 2.0×, default 1.0)

### Gantt rendering (`src/components/outputs/GanttPanel.tsx`, `gantt/SvgGantt.tsx`)

- `GanttPanel` filters groups (locations, `filterGroupsByStatus`, `applySearchFilter`), then renders `<SvgGantt tasks scales dark />`. The time axis comes from `ZOOM_PRESETS[zoomLevel]`.
- CSS `zoom` (from `scaleIdx`) is applied to the wrapper div.

### Export (`src/hooks/useExport.ts`)

`captureElement` serialises the chart's `<svg>` (XMLSerializer → Blob → canvas at 2×) into a PNG data URL; PDF (jsPDF) and PPTX (pptxgenjs) exports build on it. No html2canvas.

PDF page size is derived from the captured image at 1 CSS px = 1 pt (72 dpi), so a 12 px browser font renders as 12 pt in the PDF.

### Layout constraint

`AppShell` uses inline `style` props for the height chain so the Gantt fills the available space. `GanttPanel` is positioned `absolute; inset: 0` inside the `<main>` element. Verify `SvgGantt` still sizes correctly before moving this to Tailwind classes.

### Docker / deployment

- GitHub Pages: `base: '/360gantt/'` (default in vite.config.ts)
- Docker container: built with `VITE_BASE=/` so assets load from `/`
- `vite.config.ts` reads `process.env.VITE_BASE ?? '/360gantt/'`

## Key constraints

- **Coverage threshold** — Vitest enforces ≥ 75 % lines/functions/branches/statements on `src/engines/` and `src/utils/`. CI fails below this.
- **Biome** is the sole linter/formatter (no ESLint). Use `// biome-ignore lint/<rule>: <reason>` for suppressions, not ESLint comments.
- **TypeScript strict mode** — avoid `as any`; if a suppression is unavoidable, use `// biome-ignore` with a reason.
- Tests use `vitest` globals (no explicit imports for `describe`/`it`/`expect`).
