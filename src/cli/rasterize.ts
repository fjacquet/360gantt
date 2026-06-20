import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { Resvg, initWasm } from '@resvg/resvg-wasm'

const require = createRequire(import.meta.url)

let wasmReady: Promise<void> | null = null
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm')
    wasmReady = readFile(wasmPath).then((buf) => initWasm(new Uint8Array(buf)))
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
