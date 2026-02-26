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
  → GanttPanel       reads tasks from store, renders SVAR Gantt
```

### Engine layer (`src/engines/csv/`)

Pure functions, fully unit-tested, no React dependencies.

- **headerResolver** — normalises Dell CSV column headers across EN/FR/IT/DE using `HEADER_ALIASES`. Throws if no recognised headers are found.
- **assetFilter** — keeps only `PRODUCT TYPE = HARDWARE` + `SERVICES STATUS = Active` rows that have a parseable `CONTRACT END DATE`. Multi-language value matching via `HARDWARE_VALUES` / `ACTIVE_VALUES`.
- **dateParser** — handles two Dell date formats: `"July 23, 2026"` (US long form) and `"4yr, 3mo, 1d"` (age-from-today offset).
- **assetGrouper** — groups `ParsedAsset[]` by `locationId → productName`, computes `daysRemaining`, sorts by `contractEnd` ascending.
- **svarAdapter** — converts `LocationGroup[]` into the flat SVAR task array. Integer IDs are assigned sequentially. Three-level hierarchy: location task (`parent` unset) → product group task (`parent=locationId`) → asset task (`parent=productId`). Bar colour set via `contractStatusColor`.

### State (`src/store/assetStore.ts`)

Single Zustand store. Key slices:
- `ganttData` / `locationGroups` — output of the pipeline
- `filters` — `{ locationIds: string[], search: string }` — filtering applied inside `GanttPanel`, not in the store
- `zoomLevel` — index into `ZOOM_PRESETS` (time-axis: 5-year/Year/Quarter/Month)
- `scaleIdx` — index into `SCALE_STEPS` (CSS zoom: 0.5× … 2.0×, default 1.0)

### SVAR Gantt integration (`src/components/outputs/GanttPanel.tsx`)

- Must be wrapped in `<Willow>` or `<WillowDark>` theme — the chart is invisible without it.
- SVAR CSS must be imported as a JS import in `main.tsx` (`import '@svar-ui/react-gantt/style.css'`), **not** inside `index.css`, because `@tailwindcss/vite` strips third-party `@import` statements.
- CSS `zoom` property (from `scaleIdx`) is applied to the wrapper div — html2canvas respects it, so PDF/PPTX exports reflect the current visual scale automatically.
- The `readonly` prop disables all editing. The `columns` prop is set to a single `text` column.
- SVAR density tuning: `cellWidth={70}`, `cellHeight={28}`, `--wx-font-size: 12px`.

### Export (`src/hooks/useExport.ts`)

Before calling html2canvas, `expandForCapture` must:
1. Reset `zoom` to `1` on the container (non-standard property — accessed via `el.style as any`).
2. Set `overflow: visible; height: auto` on `.wx-gantt`, `.wx-chart`, `.wx-bars` so clipped rows/columns are rendered.
3. Restore all styles after capture (always, even on error).

PDF page size is derived from the captured image at 1 CSS px = 1 pt (72 dpi), so a 12 px browser font renders as 12 pt in the PDF.

### Layout constraint

`AppShell` uses inline `style` props (not Tailwind classes) for the height chain so that the SVAR Gantt fills the available space. `GanttPanel` is positioned `absolute; inset: 0` inside the `<main>` element. Do not change this to Tailwind classes — the SVAR component requires an explicit pixel height from its container.

### Docker / deployment

- GitHub Pages: `base: '/360gantt/'` (default in vite.config.ts)
- Docker container: built with `VITE_BASE=/` so assets load from `/`
- `vite.config.ts` reads `process.env.VITE_BASE ?? '/360gantt/'`

## Key constraints

- **Coverage threshold** — Vitest enforces ≥ 75 % lines/functions/branches/statements on the engine layer. CI fails below this.
- **Biome** is the sole linter/formatter (no ESLint). Use `// biome-ignore lint/<rule>: <reason>` for suppressions, not ESLint comments.
- **TypeScript strict mode** — `as any` is only used for the non-standard `CSSStyleDeclaration.zoom` property in `useExport.ts`.
- Tests use `vitest` globals (no explicit imports for `describe`/`it`/`expect`).
