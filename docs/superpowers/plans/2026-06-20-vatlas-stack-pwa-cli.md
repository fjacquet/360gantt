# vAtlas stack + PWA + CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring 360gantt to vAtlas-stack parity by adding a privacy-first installable PWA and a headless export CLI (`360gantt data.csv -o out.pdf`), then publish both through `fjacquet/ci@v1`.

**Architecture:** Extract the existing browser-bound CSV pipeline into a pure function so both the React app and a new Node CLI share it. The CLI renders the existing pure `SvgGantt` React component to an SVG string with `react-dom/server`, rasterizes it with `@resvg/resvg-wasm` (fonts supplied as woff2 buffers), and writes PDF/PPTX/PNG/SVG/Mermaid. The PWA uses `vite-plugin-pwa` `injectManifest` with a hand-written precache-only service worker that never caches user data.

**Tech Stack:** React 19, Vite 7, TypeScript (strict), Biome, Zustand, Vitest, `react-dom/server`, `commander`, `@resvg/resvg-wasm`, `@fontsource/inter`, `jspdf`, `pptxgenjs`, `papaparse`, `vite-plugin-pwa` + `workbox-*`.

## Global Constraints

- **Formatting (Biome):** single quotes, semicolons `asNeeded` (omit), 2-space indent, line width 100. All code below already follows this — keep it that way; run `make lint-fix` after edits.
- **TypeScript strict:** `noUncheckedIndexedAccess` is on — never index an array without a guard. `as any` is forbidden except the existing `CSSStyleDeclaration.zoom` case.
- **Coverage:** Vitest enforces ≥75% on `src/engines/**` and `src/utils/**`. New files under `src/engines/csv/` (`pipeline.ts`, `mermaid.ts`) are counted and MUST be tested. `src/cli/**` is not counted but is still tested.
- **Tests:** import `{ describe, expect, it }` from `'vitest'` explicitly (matches existing files), even though `globals: true`.
- **Node:** target Node 24 (CI default). CLI code imports node built-ins via the `node:` prefix and avoids relying on node globals (`import process from 'node:process'`, `import { Buffer } from 'node:buffer'`).
- **Commits:** conventional-commit subject; every commit message ends with the repo's two-line footer (`Co-Authored-By: …` and `Claude-Session: …`).
- **PWA manifest scope/start_url/id** must derive from `VITE_BASE` (`/360gantt/` for Pages, `/` for Docker) — never hard-code.

---

### Task 1: Extract the pure CSV pipeline (`parseCsvToGantt`)

**Files:**
- Create: `src/engines/csv/pipeline.ts`
- Test: `src/engines/csv/__tests__/pipeline.test.ts`
- Modify: `src/hooks/useCsvParse.ts`

**Interfaces:**
- Consumes (existing, unchanged): `resolveHeaders(rawHeaders: string[]): FieldMap` (`@engines/csv/headerResolver`); `toRawAsset(row, fieldMap): RawAsset` + `filterAssets(raws): ParsedAsset[]` (`@engines/csv/assetFilter`); `groupAssets(parsed): LocationGroup[]` (`@engines/csv/assetGrouper`); `toGanttData(groups): GanttData` (`@engines/csv/svarAdapter`).
- Produces: `parseCsvToGantt(csvText: string): ParseResult` where `interface ParseResult { ganttData: GanttData; locationGroups: LocationGroup[]; totalAssets: number }`, and `class NoAssetsError extends Error`.

- [ ] **Step 1: Write the failing test**

Create `src/engines/csv/__tests__/pipeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { NoAssetsError, parseCsvToGantt } from '../pipeline'

const HEADER =
  'ASSET ID,PRODUCT NAME,PRODUCT TYPE,INSTALL BASE AGE,LOCATION ID,LOCATION NAME,SERVICES STATUS,CONTRACT END DATE,END OF STANDARD SUPPORT,CITY,COUNTRY'

const HARDWARE_ROW =
  'A001,PowerEdge R740,HARDWARE,"2yr, 3mo",LOC1,Main DC,Active,"December 31, 2027",,Geneva,Switzerland'

describe('parseCsvToGantt', () => {
  it('produces gantt tasks from a valid CSV', () => {
    const result = parseCsvToGantt(`${HEADER}\n${HARDWARE_ROW}`)
    expect(result.totalAssets).toBe(1)
    expect(result.locationGroups).toHaveLength(1)
    expect(result.ganttData.tasks.length).toBeGreaterThan(0)
  })

  it('throws when no headers are recognised', () => {
    expect(() => parseCsvToGantt('foo,bar\n1,2')).toThrow(/recognised/i)
  })

  it('throws NoAssetsError when nothing matches the filter', () => {
    const software = 'A001,vSphere,SOFTWARE,1yr,LOC1,Main DC,Active,"January 01, 2030",,Geneva,Switzerland'
    expect(() => parseCsvToGantt(`${HEADER}\n${software}`)).toThrow(NoAssetsError)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engines/csv/__tests__/pipeline.test.ts`
Expected: FAIL — cannot find module `../pipeline`.

- [ ] **Step 3: Write the implementation**

Create `src/engines/csv/pipeline.ts`:

```ts
import Papa from 'papaparse'
import type { LocationGroup } from '@/types/asset'
import type { GanttData } from '@/types/gantt'
import { filterAssets, toRawAsset } from './assetFilter'
import { groupAssets } from './assetGrouper'
import { resolveHeaders } from './headerResolver'
import { toGanttData } from './svarAdapter'

export interface ParseResult {
  ganttData: GanttData
  locationGroups: LocationGroup[]
  totalAssets: number
}

/** Thrown when the CSV parses but contains no hardware/active assets. */
export class NoAssetsError extends Error {
  constructor(message = 'No hardware assets with active contracts found in this file.') {
    super(message)
    this.name = 'NoAssetsError'
  }
}

/**
 * Pure CSV → Gantt pipeline shared by the web hook and the CLI.
 * Throws on unrecognised headers (via resolveHeaders) and NoAssetsError
 * when the filter removes every row.
 */
export function parseCsvToGantt(csvText: string): ParseResult {
  const results = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })
  const rawHeaders = results.meta.fields ?? []
  const fieldMap = resolveHeaders(rawHeaders)
  const rawAssets = results.data.map((row) => toRawAsset(row, fieldMap))
  const parsed = filterAssets(rawAssets)
  if (parsed.length === 0) {
    throw new NoAssetsError()
  }
  const locationGroups = groupAssets(parsed)
  const ganttData = toGanttData(locationGroups)
  return { ganttData, locationGroups, totalAssets: parsed.length }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engines/csv/__tests__/pipeline.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Refactor `useCsvParse` to use the shared pipeline**

Replace the body of `src/hooks/useCsvParse.ts` with:

```ts
import { toast } from 'sonner'
import { NoAssetsError, parseCsvToGantt } from '@engines/csv/pipeline'
import { useAssetStore } from '@store/assetStore'

export function useCsvParse() {
  const { setLoading, setError, setData } = useAssetStore()

  const parseFile = async (file: File) => {
    setLoading(true)
    try {
      const text = await file.text()
      const { ganttData, locationGroups, totalAssets } = parseCsvToGantt(text)
      setData(locationGroups, ganttData, totalAssets, file.name)
      toast.success(`Loaded ${totalAssets} assets across ${locationGroups.length} locations`)
    } catch (err) {
      if (err instanceof NoAssetsError) {
        toast.warning(err.message)
        setError('No matching assets found.')
        return
      }
      const msg = err instanceof Error ? err.message : 'Unknown parse error'
      setError(msg)
      toast.error(`Parse error: ${msg}`)
    }
  }

  return { parseFile }
}
```

- [ ] **Step 6: Verify typecheck, lint, and the full suite still pass**

Run: `make typecheck && npx vitest run`
Expected: PASS. (`parseFile` is now async; existing callers fire-and-forget it, which is fine.)

- [ ] **Step 7: Commit**

```bash
git add src/engines/csv/pipeline.ts src/engines/csv/__tests__/pipeline.test.ts src/hooks/useCsvParse.ts
git commit -m "refactor: extract pure parseCsvToGantt pipeline shared by app and CLI"
```

---

### Task 2: Extract the pure Mermaid builder (`toMermaid`)

**Files:**
- Create: `src/engines/csv/mermaid.ts`
- Test: `src/engines/csv/__tests__/mermaid.test.ts`
- Modify: `src/hooks/useExport.ts`

**Interfaces:**
- Produces: `toMermaid(tasks: GanttTask[]): string`.
- Consumes: `GanttTask` from `@/types/gantt`.

- [ ] **Step 1: Write the failing test**

Create `src/engines/csv/__tests__/mermaid.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { GanttTask } from '@/types/gantt'
import { toMermaid } from '../mermaid'

const tasks: GanttTask[] = [
  { id: 1, text: 'Main DC', start: new Date(2024, 0, 1), end: new Date(2027, 0, 1), type: 'summary' },
  { id: 2, text: 'PowerEdge R740', start: new Date(2024, 0, 1), end: new Date(2027, 0, 1), type: 'summary', parent: 1 },
  { id: 3, text: 'R740 (A1)', start: new Date(2024, 0, 1), end: new Date(2026, 5, 30), type: 'task', parent: 2, color: '#0076ce' },
]

describe('toMermaid', () => {
  it('starts a gantt document with a section per location', () => {
    const out = toMermaid(tasks)
    expect(out.startsWith('gantt')).toBe(true)
    expect(out).toContain('section Main DC')
  })

  it('emits an active status for the Dell blue bar', () => {
    expect(toMermaid(tasks)).toContain('active, 2024-01-01, 2026-06-30')
  })

  it('returns an empty gantt for no tasks', () => {
    expect(toMermaid([])).toContain('gantt')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engines/csv/__tests__/mermaid.test.ts`
Expected: FAIL — cannot find module `../mermaid`.

- [ ] **Step 3: Write the implementation**

Create `src/engines/csv/mermaid.ts` (logic lifted verbatim from `useExport.exportMermaid`):

```ts
import type { GanttTask } from '@/types/gantt'

/** Maps a bar color to a Mermaid task status keyword. */
function colorToMermaidStatus(color: string | undefined): string {
  if (!color) return ''
  const c = color.toLowerCase()
  if (c === '#003b6f') return 'crit, ' // Dell dark blue = critical
  if (c === '#0076ce') return 'active, ' // Dell blue = warning
  if (c === '#9ca3af') return 'done, ' // gray = expired/done
  return '' // Dell light blue or unknown = default
}

function formatMermaidDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Converts the flat Gantt task array into a Mermaid `gantt` document. */
export function toMermaid(tasks: GanttTask[]): string {
  const lines: string[] = ['gantt', '  title 360gantt Export', '  dateFormat YYYY-MM-DD']

  for (const task of tasks) {
    if (task.type === 'summary' && (task.parent === 0 || task.parent === undefined)) {
      lines.push(`  section ${task.text}`)
      const products = tasks.filter((t) => t.parent === task.id && t.type === 'summary')
      for (const prod of products) {
        const assets = tasks.filter((t) => t.parent === prod.id && t.type === 'task')
        if (assets.length > 0) {
          for (const asset of assets) {
            const status = colorToMermaidStatus(asset.color)
            lines.push(
              `    ${asset.text} :${status}${formatMermaidDate(asset.start)}, ${formatMermaidDate(asset.end)}`,
            )
          }
        } else {
          const status = colorToMermaidStatus(prod.color)
          lines.push(
            `    ${prod.text} :${status}${formatMermaidDate(prod.start)}, ${formatMermaidDate(prod.end)}`,
          )
        }
      }
    }
  }

  return lines.join('\n')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engines/csv/__tests__/mermaid.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Refactor `useExport.exportMermaid` to use the helper**

In `src/hooks/useExport.ts`: delete the local `colorToMermaidStatus` and `formatMermaidDate` functions, add `import { toMermaid } from '@engines/csv/mermaid'`, and replace the body of `exportMermaid` so the `lines`-building loop becomes:

```ts
  const exportMermaid = () => {
    const { ganttData } = useAssetStore.getState()
    const tasks = ganttData.tasks
    if (tasks.length === 0) return

    const content = toMermaid(tasks)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '360gantt-export.mmd'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Mermaid file downloaded')
  }
```

- [ ] **Step 6: Verify typecheck + full suite**

Run: `make typecheck && npx vitest run`
Expected: PASS, no unused-import lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/engines/csv/mermaid.ts src/engines/csv/__tests__/mermaid.test.ts src/hooks/useExport.ts
git commit -m "refactor: extract pure toMermaid builder for app + CLI reuse"
```

---

### Task 3: CLI SVG renderer (`renderGanttSvg`)

**Files:**
- Create: `src/cli/render.ts`
- Test: `src/cli/__tests__/render.test.ts`

**Interfaces:**
- Produces: `renderGanttSvg(tasks: GanttTask[], scales: ZoomScale[], options?: { dark?: boolean }): string`.
- Consumes: `SvgGantt` (`@components/outputs/gantt/SvgGantt`); `ZOOM_PRESETS`, `ZoomScale` (`@store/assetStore`); `GanttTask` (`@/types/gantt`).

- [ ] **Step 1: Write the failing test**

Create `src/cli/__tests__/render.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ZOOM_PRESETS } from '@store/assetStore'
import type { GanttTask } from '@/types/gantt'
import { renderGanttSvg } from '../render'

const tasks: GanttTask[] = [
  { id: 1, text: 'Geneva DC', start: new Date(2024, 0, 1), end: new Date(2027, 0, 1), type: 'summary', open: true },
  { id: 2, text: 'PowerEdge R740', start: new Date(2024, 0, 1), end: new Date(2027, 0, 1), type: 'task', parent: 1, color: '#0076ce' },
]

describe('renderGanttSvg', () => {
  it('returns an SVG string containing the chart and bar colour', () => {
    const svg = renderGanttSvg(tasks, ZOOM_PRESETS[1]?.scales ?? [])
    expect(svg).toContain('<svg')
    expect(svg).toContain('Asset / Product')
    expect(svg).toContain('#0076ce')
  })

  it('throws when there is nothing to render', () => {
    expect(() => renderGanttSvg([], ZOOM_PRESETS[1]?.scales ?? [])).toThrow(/nothing to render/i)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/cli/__tests__/render.test.ts`
Expected: FAIL — cannot find module `../render`.

- [ ] **Step 3: Write the implementation**

Create `src/cli/render.ts`:

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SvgGantt } from '@components/outputs/gantt/SvgGantt'
import type { ZoomScale } from '@store/assetStore'
import type { GanttTask } from '@/types/gantt'

export interface RenderOptions {
  dark?: boolean
}

/**
 * Server-renders the pure SvgGantt component to an SVG string.
 * Throws if the dataset produces no chart (SvgGantt returns null).
 */
export function renderGanttSvg(
  tasks: GanttTask[],
  scales: ZoomScale[],
  options: RenderOptions = {},
): string {
  const markup = renderToStaticMarkup(
    createElement(SvgGantt, { tasks, scales, dark: options.dark ?? false }),
  )
  if (!markup.includes('<svg')) {
    throw new Error('Nothing to render: the dataset produced no Gantt rows.')
  }
  return markup
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/cli/__tests__/render.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cli/render.ts src/cli/__tests__/render.test.ts
git commit -m "feat(cli): render SvgGantt to an SVG string via react-dom/server"
```

---

### Task 4: CLI rasterizer (`svgToPng`)

**Files:**
- Create: `src/cli/rasterize.ts`
- Test: `src/cli/__tests__/rasterize.test.ts`
- Modify: `package.json` (add runtime deps)

**Interfaces:**
- Produces: `svgToPng(svg: string, zoom?: number): Promise<RasterResult>` where `interface RasterResult { data: Uint8Array; width: number; height: number }`.

- [ ] **Step 1: Add the runtime dependencies**

Run: `npm install @resvg/resvg-wasm @fontsource/inter`
Then confirm the bundled font filename:
Run: `ls node_modules/@fontsource/inter/files | grep 'latin-400-normal.woff2'`
Expected: `inter-latin-400-normal.woff2` exists. If the exact name differs, use the printed name in Step 3.

- [ ] **Step 2: Write the failing test**

Create `src/cli/__tests__/rasterize.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { svgToPng } from '../rasterize'

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#0076ce"/><text x="6" y="24" font-family="Inter" font-size="14" fill="#fff">Hi</text></svg>'

describe('svgToPng', () => {
  it('renders a non-empty PNG at the requested zoom', async () => {
    const { data, width, height } = await svgToPng(SVG, 2)
    expect(data.byteLength).toBeGreaterThan(100)
    expect(width).toBe(240)
    expect(height).toBe(80)
    // PNG magic bytes
    expect(Array.from(data.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 30000)
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/cli/__tests__/rasterize.test.ts`
Expected: FAIL — cannot find module `../rasterize`.

- [ ] **Step 4: Write the implementation**

Create `src/cli/rasterize.ts` (no `Buffer` import — `rasterize.ts` does not need it):

```ts
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { Resvg, initWasm } from '@resvg/resvg-wasm'

const require = createRequire(import.meta.url)

let wasmReady: Promise<void> | null = null
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    const pkgDir = dirname(require.resolve('@resvg/resvg-wasm/package.json'))
    wasmReady = readFile(join(pkgDir, 'index_bg.wasm')).then((buf) => initWasm(buf))
  }
  return wasmReady
}

let fontBuffer: Uint8Array | null = null
async function loadFont(): Promise<Uint8Array> {
  if (!fontBuffer) {
    const pkgDir = dirname(require.resolve('@fontsource/inter/package.json'))
    const file = join(pkgDir, 'files', 'inter-latin-400-normal.woff2')
    fontBuffer = new Uint8Array(await readFile(file))
  }
  return fontBuffer
}

export interface RasterResult {
  data: Uint8Array
  width: number
  height: number
}

/** Rasterizes an SVG string to a PNG. `zoom` scales the intrinsic size (2 = 2x). */
export async function svgToPng(svg: string, zoom = 2): Promise<RasterResult> {
  await ensureWasm()
  const font = await loadFont()
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: zoom },
    font: { fontBuffers: [font], defaultFontFamily: 'Inter', loadSystemFonts: false },
  })
  const rendered = resvg.render()
  return { data: rendered.asPng(), width: rendered.width, height: rendered.height }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/cli/__tests__/rasterize.test.ts`
Expected: PASS — width 240, height 80, PNG magic bytes present (confirms the Inter font buffer loaded without error).

- [ ] **Step 6: Commit**

```bash
git add src/cli/rasterize.ts src/cli/__tests__/rasterize.test.ts package.json package-lock.json
git commit -m "feat(cli): rasterize SVG to PNG via @resvg/resvg-wasm with Inter font"
```

---

### Task 5: CLI exporters (`writeExport`, `formatFromPath`)

**Files:**
- Create: `src/cli/exporters.ts`
- Test: `src/cli/__tests__/exporters.test.ts`

**Interfaces:**
- Produces: `type ExportFormat = 'svg' | 'png' | 'pdf' | 'pptx' | 'mmd'`; `formatFromPath(outPath: string): ExportFormat`; `writeExport(format: ExportFormat, input: ExportInput): Promise<void>` where `interface ExportInput { svg: string; tasks: GanttTask[]; outPath: string }`.
- Consumes: `svgToPng` (`./rasterize`), `toMermaid` (`@engines/csv/mermaid`), `GanttTask` (`@/types/gantt`), `jspdf`, `pptxgenjs`.

- [ ] **Step 1: Write the failing test**

Create `src/cli/__tests__/exporters.test.ts`:

```ts
import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GanttTask } from '@/types/gantt'
import { formatFromPath, writeExport } from '../exporters'
import { renderGanttSvg } from '../render'
import { ZOOM_PRESETS } from '@store/assetStore'

const tasks: GanttTask[] = [
  { id: 1, text: 'Geneva DC', start: new Date(2024, 0, 1), end: new Date(2027, 0, 1), type: 'summary', open: true },
  { id: 2, text: 'PowerEdge R740', start: new Date(2024, 0, 1), end: new Date(2027, 0, 1), type: 'task', parent: 1, color: '#0076ce' },
]

describe('formatFromPath', () => {
  it('maps extensions to formats', () => {
    expect(formatFromPath('a.pdf')).toBe('pdf')
    expect(formatFromPath('a.PPTX')).toBe('pptx')
  })
  it('throws on an unsupported extension', () => {
    expect(() => formatFromPath('a.txt')).toThrow(/unsupported/i)
  })
})

describe('writeExport', () => {
  const svg = renderGanttSvg(tasks, ZOOM_PRESETS[1]?.scales ?? [])

  it.each(['svg', 'png', 'pdf', 'pptx', 'mmd'] as const)('writes a %s file', async (fmt) => {
    const out = join(tmpdir(), `360gantt-test.${fmt}`)
    await writeExport(fmt, { svg, tasks, outPath: out })
    expect(existsSync(out)).toBe(true)
    expect((await readFile(out)).byteLength).toBeGreaterThan(100)
    await rm(out, { force: true })
  }, 30000)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/cli/__tests__/exporters.test.ts`
Expected: FAIL — cannot find module `../exporters`.

- [ ] **Step 3: Write the implementation**

Create `src/cli/exporters.ts`:

```ts
import { Buffer } from 'node:buffer'
import { writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { jsPDF } from 'jspdf'
import PptxGenJS from 'pptxgenjs'
import { toMermaid } from '@engines/csv/mermaid'
import type { GanttTask } from '@/types/gantt'
import { svgToPng } from './rasterize'

export type ExportFormat = 'svg' | 'png' | 'pdf' | 'pptx' | 'mmd'

const EXT_TO_FORMAT: Record<string, ExportFormat> = {
  '.svg': 'svg',
  '.png': 'png',
  '.pdf': 'pdf',
  '.pptx': 'pptx',
  '.mmd': 'mmd',
}

export function formatFromPath(outPath: string): ExportFormat {
  const ext = extname(outPath).toLowerCase()
  const format = EXT_TO_FORMAT[ext]
  if (!format) {
    throw new Error(`Unsupported output extension "${ext}". Use .svg, .png, .pdf, .pptx or .mmd`)
  }
  return format
}

export interface ExportInput {
  svg: string
  tasks: GanttTask[]
  outPath: string
}

function toDataUri(png: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(png).toString('base64')}`
}

export async function writeExport(format: ExportFormat, input: ExportInput): Promise<void> {
  switch (format) {
    case 'svg':
      await writeFile(input.outPath, input.svg, 'utf8')
      return
    case 'mmd':
      await writeFile(input.outPath, toMermaid(input.tasks), 'utf8')
      return
    case 'png': {
      const { data } = await svgToPng(input.svg)
      await writeFile(input.outPath, data)
      return
    }
    case 'pdf':
      await writePdf(input.svg, input.outPath)
      return
    case 'pptx':
      await writePptx(input.svg, input.outPath)
      return
  }
}

async function writePdf(svg: string, outPath: string): Promise<void> {
  const { data, width, height } = await svgToPng(svg)
  const w = width / 2
  const h = height / 2
  const doc = new jsPDF({ orientation: w >= h ? 'landscape' : 'portrait', unit: 'pt', format: [w, h] })
  doc.addImage(toDataUri(data), 'PNG', 0, 0, w, h)
  await writeFile(outPath, Buffer.from(doc.output('arraybuffer')))
}

async function writePptx(svg: string, outPath: string): Promise<void> {
  const { data, width, height } = await svgToPng(svg)
  const inchW = width / 2 / 96
  const inchH = height / 2 / 96
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'GANTT', width: inchW, height: inchH })
  pptx.layout = 'GANTT'
  const slide = pptx.addSlide()
  slide.addImage({ data: toDataUri(data), x: 0, y: 0, w: inchW, h: inchH })
  await pptx.writeFile({ fileName: outPath })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/cli/__tests__/exporters.test.ts`
Expected: PASS — all five formats written, each > 100 bytes.

- [ ] **Step 5: Commit**

```bash
git add src/cli/exporters.ts src/cli/__tests__/exporters.test.ts
git commit -m "feat(cli): write pdf/pptx/png/svg/mmd exports from a rendered chart"
```

---

### Task 6: CLI entry point + end-to-end fixture test

**Files:**
- Create: `src/cli/index.ts`
- Create: `tests/fixtures/sample-assets.csv`
- Create: `src/cli/__tests__/export.e2e.test.ts`
- Modify: `package.json` (add `commander`)

**Interfaces:**
- Produces: `buildProgram(): Command` (exported for clarity; the module also auto-runs when executed as the bin).
- Consumes: `parseCsvToGantt`, `renderGanttSvg`, `formatFromPath`/`writeExport`, `ZOOM_PRESETS`.

- [ ] **Step 1: Add the dependency**

Run: `npm install commander`

- [ ] **Step 2: Create the test fixture**

Create `tests/fixtures/sample-assets.csv`:

```csv
ASSET ID,PRODUCT NAME,PRODUCT TYPE,INSTALL BASE AGE,LOCATION ID,LOCATION NAME,SERVICES STATUS,CONTRACT END DATE,END OF STANDARD SUPPORT,CITY,COUNTRY
A001,PowerEdge R740,HARDWARE,"2yr, 3mo",LOC1,Main DC,Active,"December 31, 2027",,Geneva,Switzerland
A002,PowerEdge R740,HARDWARE,"1yr",LOC1,Main DC,Active,"June 30, 2028",,Geneva,Switzerland
A003,Unity XT,HARDWARE,"3yr",LOC2,Backup DC,Active,"March 15, 2026",,Zurich,Switzerland
A004,vSphere License,SOFTWARE,"1yr",LOC1,Main DC,Active,"January 01, 2030",,Geneva,Switzerland
```

- [ ] **Step 3: Write the failing end-to-end test**

Create `src/cli/__tests__/export.e2e.test.ts`:

```ts
import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { parseCsvToGantt } from '@engines/csv/pipeline'
import { ZOOM_PRESETS } from '@store/assetStore'
import { writeExport } from '../exporters'
import { renderGanttSvg } from '../render'

const FIXTURE = join(process.cwd(), 'tests', 'fixtures', 'sample-assets.csv')

describe('cli export pipeline (fixture → every format)', () => {
  it('parses the fixture and renders all formats', async () => {
    const csv = await readFile(FIXTURE, 'utf8')
    const { ganttData, totalAssets } = parseCsvToGantt(csv)
    expect(totalAssets).toBe(3) // three hardware/active rows; the software row is filtered

    const svg = renderGanttSvg(ganttData.tasks, ZOOM_PRESETS[1]?.scales ?? [])
    for (const fmt of ['svg', 'png', 'pdf', 'pptx', 'mmd'] as const) {
      const out = join(tmpdir(), `360gantt-e2e.${fmt}`)
      await writeExport(fmt, { svg, tasks: ganttData.tasks, outPath: out })
      expect(existsSync(out)).toBe(true)
      await rm(out, { force: true })
    }
  }, 30000)
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/cli/__tests__/export.e2e.test.ts`
Expected: FAIL — `tests/fixtures/sample-assets.csv` exists but the test passes only once the fixture is correct; if it fails on `totalAssets`, re-check the fixture rows. (The test file compiles already; this step confirms the fixture + pipeline integrate.)

- [ ] **Step 5: Write the CLI entry**

Create `src/cli/index.ts`:

```ts
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { Command } from 'commander'
import { parseCsvToGantt } from '@engines/csv/pipeline'
import { ZOOM_PRESETS } from '@store/assetStore'
import { formatFromPath, writeExport } from './exporters'
import { renderGanttSvg } from './render'

function resolveZoomIndex(preset: string): number {
  const target = preset.trim().toLowerCase()
  const idx = ZOOM_PRESETS.findIndex((p) => p.label.toLowerCase() === target)
  if (idx === -1) {
    const labels = ZOOM_PRESETS.map((p) => p.label).join(', ')
    throw new Error(`Unknown zoom "${preset}". Available: ${labels}`)
  }
  return idx
}

export function buildProgram(): Command {
  const program = new Command()
  program
    .name('360gantt')
    .description('Render a Dell asset export CSV to a Gantt chart (pdf/pptx/png/svg/mmd).')
    .argument('<input>', 'path to the Dell asset export CSV')
    .requiredOption('-o, --output <file>', 'output file; format inferred from its extension')
    .option('-z, --zoom <preset>', 'time-axis zoom preset (5-year | Year)', 'Year')
    .option('--dark', 'render using the dark palette', false)
    .action(async (input: string, opts: { output: string; zoom: string; dark: boolean }) => {
      const format = formatFromPath(opts.output)
      const zoomIdx = resolveZoomIndex(opts.zoom)
      const preset = ZOOM_PRESETS[zoomIdx]
      if (!preset) throw new Error('Invalid zoom preset.')
      const csv = await readFile(input, 'utf8')
      const { ganttData } = parseCsvToGantt(csv)
      const svg = renderGanttSvg(ganttData.tasks, preset.scales, { dark: opts.dark })
      await writeExport(format, { svg, tasks: ganttData.tasks, outPath: opts.output })
      process.stdout.write(`Wrote ${opts.output}\n`)
    })
  return program
}

buildProgram()
  .parseAsync(process.argv)
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
    process.exitCode = 1
  })
```

- [ ] **Step 6: Run the e2e test + full suite + typecheck**

Run: `npx vitest run src/cli && make typecheck`
Expected: PASS. (`index.ts` is not imported by any test, so its auto-run does not execute during the suite.)

- [ ] **Step 7: Commit**

```bash
git add src/cli/index.ts tests/fixtures/sample-assets.csv src/cli/__tests__/export.e2e.test.ts package.json package-lock.json
git commit -m "feat(cli): add 360gantt command entry with fixture e2e test"
```

---

### Task 7: CLI build config + npm packaging

**Files:**
- Create: `vite.cli.config.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `dist-cli/index.js` (ESM, `#!/usr/bin/env node` shebang) and a publishable package exposing `bin."360gantt"`.

- [ ] **Step 1: Create the CLI Vite build config**

Create `vite.cli.config.ts`:

```ts
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@engines': resolve(__dirname, './src/engines'),
      '@components': resolve(__dirname, './src/components'),
      '@store': resolve(__dirname, './src/store'),
      '@types': resolve(__dirname, './src/types'),
      '@utils': resolve(__dirname, './src/utils'),
      '@data': resolve(__dirname, './src/data'),
      '@hooks': resolve(__dirname, './src/hooks'),
    },
  },
  build: {
    ssr: resolve(__dirname, 'src/cli/index.ts'),
    outDir: 'dist-cli',
    target: 'node20',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        format: 'es',
        banner: '#!/usr/bin/env node',
      },
    },
  },
})
```

- [ ] **Step 2: Update `package.json` metadata and scripts**

Apply these edits to `package.json`:
- `"name": "360gantt"` → `"name": "@fjacquet/360gantt"`
- `"private": true` → `"private": false`
- Add top-level keys:

```json
  "bin": { "360gantt": "./dist-cli/index.js" },
  "files": ["dist-cli"],
  "publishConfig": { "registry": "https://npm.pkg.github.com" },
```

- Add to `"scripts"`:

```json
    "build:cli": "vite build -c vite.cli.config.ts",
    "prepack": "npm run build:cli",
```

(Leave `"build": "tsc -b && vite build"` unchanged so `web-ci`/`web-deploy` stay web-only. `prepack` guarantees `dist-cli/` exists whenever the package is published.)

- [ ] **Step 3: Build the CLI**

Run: `npm run build:cli`
Expected: `dist-cli/index.js` created; its first line is `#!/usr/bin/env node`.

- [ ] **Step 4: Smoke-test the built binary**

Run: `node dist-cli/index.js tests/fixtures/sample-assets.csv -o /tmp/360gantt-smoke.pdf && node dist-cli/index.js tests/fixtures/sample-assets.csv -o /tmp/360gantt-smoke.pptx`
Expected: prints `Wrote /tmp/...`; both files exist and open. Then verify error handling:
Run: `node dist-cli/index.js tests/fixtures/sample-assets.csv -o /tmp/x.txt; echo "exit=$?"`
Expected: stderr `Unsupported output extension ".txt"...`, `exit=1`.

- [ ] **Step 5: Verify the publish payload**

Run: `npm pack --dry-run`
Expected: tarball contents are limited to `dist-cli/**`, `package.json`, `README.md`, and `LICENSE` (no `src/`, no web `dist/`). Add `dist-cli/` to `.gitignore` if not already ignored.

- [ ] **Step 6: Commit**

```bash
git add vite.cli.config.ts package.json package-lock.json .gitignore
git commit -m "build(cli): package 360gantt as a publishable npm bin via Vite SSR build"
```

---

### Task 8: Generate PWA icons

**Files:**
- Create: `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png` (generated)

- [ ] **Step 1: Generate icons from the existing logo**

Run: `npx @vite-pwa/assets-generator@latest --preset minimal-2023 public/logo.svg`
Expected: writes `public/pwa-64x64.png`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon-180x180.png`. (Does not touch `favicon.svg`.)

- [ ] **Step 2: Verify the maskable icon has safe-zone padding**

Run: `node -e "const{statSync}=require('node:fs');for(const f of ['pwa-192x192','pwa-512x512','maskable-icon-512x512'])console.log(f, statSync('public/'+f+'.png').size)"`
Expected: three non-zero sizes printed.

- [ ] **Step 3: Commit**

```bash
git add public/pwa-64x64.png public/pwa-192x192.png public/pwa-512x512.png public/maskable-icon-512x512.png public/apple-touch-icon-180x180.png
git commit -m "feat(pwa): generate app icons from logo.svg"
```

---

### Task 9: vite-plugin-pwa + precache-only service worker + privacy guard

**Files:**
- Create: `src/sw.ts`
- Create: `src/privacy/fetchGuard.ts`
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`
- Modify: `package.json` (dev deps)

**Interfaces:**
- Produces: a built `dist/sw.js` + `dist/manifest.webmanifest`; `installFetchGuard(): void`.

- [ ] **Step 1: Add the build/runtime-SW dependencies**

Run: `npm install -D vite-plugin-pwa workbox-precaching workbox-routing workbox-strategies`

- [ ] **Step 2: Create the privacy fetch guard**

Create `src/privacy/fetchGuard.ts`:

```ts
import { createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setCatchHandler, setDefaultHandler } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

/**
 * Privacy-first runtime policy for the service worker:
 *  - SPA navigations are served from the precached app shell (works offline).
 *  - Everything else is NetworkOnly, so user CSV / asset data is never cached.
 */
export function installFetchGuard(): void {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
  setDefaultHandler(new NetworkOnly())
  setCatchHandler(async () => Response.error())
}
```

- [ ] **Step 3: Create the service worker**

Create `src/sw.ts`:

```ts
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { installFetchGuard } from './privacy/fetchGuard'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)
installFetchGuard()

// Prompt-for-update: registerSW posts SKIP_WAITING when the user clicks Reload.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})
```

- [ ] **Step 4: Wire the plugin + manifest into `vite.config.ts`**

Edit `src/../vite.config.ts`: add `import { VitePWA } from 'vite-plugin-pwa'`, hoist the base into a const, and add the plugin. The file becomes:

```ts
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.VITE_BASE ?? '/360gantt/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      manifest: {
        id: base,
        name: '360gantt — Asset Lifecycle Visualizer',
        short_name: '360gantt',
        description: 'Visualize Dell asset contract timelines as an interactive Gantt chart.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0076ce',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@engines': resolve(__dirname, './src/engines'),
      '@components': resolve(__dirname, './src/components'),
      '@store': resolve(__dirname, './src/store'),
      '@types': resolve(__dirname, './src/types'),
      '@utils': resolve(__dirname, './src/utils'),
      '@data': resolve(__dirname, './src/data'),
      '@hooks': resolve(__dirname, './src/hooks'),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-pdf': ['jspdf'],
          'vendor-pptx': ['pptxgenjs'],
          'vendor-state': ['zustand'],
        },
      },
    },
  },
})
```

- [ ] **Step 5: Exclude `sw.ts` from app type-check and add PWA client types**

In `tsconfig.app.json`:
- change `"types": ["vite/client"]` → `"types": ["vite/client", "vite-plugin-pwa/client"]`
- change `"include": ["src"]` to also exclude the SW:

```json
  "include": ["src"],
  "exclude": ["src/sw.ts"]
```

(The SW is compiled by vite-plugin-pwa's own esbuild context; excluding it from `tsc` avoids DOM-vs-WebWorker lib conflicts.)

- [ ] **Step 6: Build and verify the SW + manifest are emitted**

Run: `npm run build`
Then: `node -e "const{existsSync}=require('node:fs');console.log('sw',existsSync('dist/sw.js'),'manifest',existsSync('dist/manifest.webmanifest'))"`
Expected: `sw true manifest true`. Open `dist/manifest.webmanifest` and confirm `"scope": "/360gantt/"` and `"start_url": "/360gantt/"`.

- [ ] **Step 7: Verify the Docker base produces a `/` manifest**

Run: `VITE_BASE=/ npm run build && node -e "console.log(require('node:fs').readFileSync('dist/manifest.webmanifest','utf8'))" | grep -E 'scope|start_url'`
Expected: `"scope": "/"`, `"start_url": "/"`.

- [ ] **Step 8: Commit**

```bash
git add src/sw.ts src/privacy/fetchGuard.ts vite.config.ts tsconfig.app.json package.json package-lock.json
git commit -m "feat(pwa): precache-only service worker with privacy fetch guard"
```

---

### Task 10: Service-worker registration + update prompt

**Files:**
- Create: `src/pwa/registerSW.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `setupPWA(): void` — registers the SW and shows a sonner toast on `onNeedRefresh` / `onOfflineReady`.
- Consumes: `registerSW` from `virtual:pwa-register` (typed via `vite-plugin-pwa/client`); `toast` from `sonner`.

- [ ] **Step 1: Create the registration module**

Create `src/pwa/registerSW.ts`:

```ts
import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'

/** Registers the service worker and prompts the user to reload on update. */
export function setupPWA(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      toast('A new version is available.', {
        action: { label: 'Reload', onClick: () => void updateSW(true) },
        duration: Number.POSITIVE_INFINITY,
      })
    },
    onOfflineReady() {
      toast.success('Ready to work offline.')
    },
  })
}
```

- [ ] **Step 2: Call it from `main.tsx`**

In `src/main.tsx`, add `import { setupPWA } from './pwa/registerSW'` and call `setupPWA()` after `createRoot(...).render(...)`:

```ts
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/config'
import './index.css'
import App from './App'
import { setupPWA } from './pwa/registerSW'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

setupPWA()
```

- [ ] **Step 3: Verify typecheck + build**

Run: `make typecheck && npm run build`
Expected: PASS — `virtual:pwa-register` resolves (types from `vite-plugin-pwa/client`), build emits the SW.

- [ ] **Step 4: Manual install/offline check**

Run: `make preview` then open the served URL in Chrome.
Expected: an install icon appears in the address bar; after first load, set DevTools → Network → Offline and reload — the app shell still renders. In DevTools → Application → Cache Storage, only build assets are present (no CSV data). Load a CSV, re-check Cache Storage — still only build assets.

- [ ] **Step 5: Commit**

```bash
git add src/pwa/registerSW.ts src/main.tsx
git commit -m "feat(pwa): register service worker with prompt-to-update toast"
```

---

### Task 11: Publish the CLI through ci@v1 release

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Enable npm publish in the release workflow**

In `.github/workflows/release.yml`, change `publish-npm: false` to `publish-npm: true`. The job becomes:

```yaml
jobs:
  release:
    uses: fjacquet/ci/.github/workflows/web-release.yml@v1
    with:
      node-version: "24"
      publish-npm: true
      publish-docker: true
      build-dir: "dist"
```

- [ ] **Step 2: Sanity-check the publish contract locally**

Run: `npm pkg get name private publishConfig bin files`
Expected: `name` = `@fjacquet/360gantt`, `private` = `false`, `publishConfig.registry` = `https://npm.pkg.github.com`, `bin."360gantt"` set, `files` = `["dist-cli"]`. (`web-release@v1`'s npm-publish step runs `npm publish`, which triggers `prepack` → `build:cli`, so `dist-cli/` is built at publish time.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: publish the 360gantt CLI to GitHub Packages on release"
```

---

### Task 12 (OPTIONAL): vAtlas version parity

Only attempt this if the core work above is green. Skip without guilt if `make ci` regresses.

**Files:**
- Modify: `package.json` (`vite` → `^8`, `@biomejs/biome` → `^2.4.15`)
- Create: `scripts/check-supply-chain.mjs` (port from vAtlas, if present there)

- [ ] **Step 1: Bump Vite and Biome to vAtlas versions**

Run: `npm install -D vite@^8 @biomejs/biome@^2.4.15`

- [ ] **Step 2: Run the full CI gate**

Run: `make ci`
Expected: typecheck + lint + coverage (≥75%) + build all PASS, and `npm run build:cli` still produces a working binary (re-run the Task 7 Step 4 smoke test).
If anything regresses, `git checkout -- package.json package-lock.json` and stop — defer the bump.

- [ ] **Step 3: Commit (only if green)**

```bash
git add package.json package-lock.json scripts/check-supply-chain.mjs
git commit -m "chore: align vite/biome versions with the vAtlas stack"
```

---

## Final verification

After all tasks:

1. Run: `make ci` — typecheck + lint + coverage (≥75%) + web build all green.
2. Run: `npm run build:cli && node dist-cli/index.js tests/fixtures/sample-assets.csv -o /tmp/g.pdf && node dist-cli/index.js tests/fixtures/sample-assets.csv -o /tmp/g.pptx && node dist-cli/index.js tests/fixtures/sample-assets.csv -o /tmp/g.png && node dist-cli/index.js tests/fixtures/sample-assets.csv -o /tmp/g.svg && node dist-cli/index.js tests/fixtures/sample-assets.csv -o /tmp/g.mmd` — all five files produced; open `/tmp/g.pdf` and confirm chart **text labels are visible** (validates the bundled Inter font).
3. Run: `make preview`, open in Chrome → install prompt appears; offline reload serves the app shell; Cache Storage holds only build assets (no CSV data).
4. Run: `npm pack --dry-run` — payload limited to `dist-cli/**` + `package.json` + `README`/`LICENSE`.
5. Push a `vX.Y.Z` tag on a test branch (or inspect the workflow run) to confirm `web-release@v1` builds, publishes the CLI to GitHub Packages under `@fjacquet/360gantt`, and pushes the Docker image.

## Self-review notes

- **Spec coverage:** pure-core extraction → Tasks 1–2; CLI render/rasterize/export/entry/build → Tasks 3–7; PWA icons/SW/registration → Tasks 8–10; ci release wiring → Task 11; stack parity → Task 12. All spec sections map to a task.
- **Refinement vs. spec:** the spec said "bundle a TTF"; this plan uses `@fontsource/inter`'s **woff2** via `createRequire` (resvg-wasm accepts woff2 font buffers) — reproducible and no committed binary. Equivalent outcome (Inter text in headless renders).
- **Type consistency:** `RasterResult`, `ExportFormat`, `ExportInput`, `ParseResult`, `RenderOptions`, `svgToPng`, `writeExport`, `formatFromPath`, `renderGanttSvg`, `parseCsvToGantt`, `toMermaid`, `setupPWA`, `installFetchGuard`, `buildProgram` are used identically wherever referenced.
- **Known watch-item:** font filename `inter-latin-400-normal.woff2` is verified in Task 4 Step 1 before use; if a future `@fontsource/inter` renames it, the printed name is substituted.
