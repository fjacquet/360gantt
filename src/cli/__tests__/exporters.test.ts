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
  { id: 2, text: 'PowerEdge R740', start: new Date(2024, 0, 1), end: new Date(2027, 0, 1), type: 'summary', parent: 1, open: true },
  { id: 3, text: 'SVC-12345', start: new Date(2024, 0, 1), end: new Date(2027, 0, 1), type: 'task', parent: 2, color: '#0076ce' },
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
  const scales = ZOOM_PRESETS[1]?.scales
  if (!scales) throw new Error('ZOOM_PRESETS[1] missing — test fixture broken')
  const svg = renderGanttSvg(tasks, scales)

  it.each(['svg', 'png', 'pdf', 'pptx', 'mmd'] as const)('writes a %s file', async (fmt) => {
    const out = join(tmpdir(), `360gantt-test.${fmt}`)
    await writeExport(fmt, { svg, tasks, outPath: out })
    expect(existsSync(out)).toBe(true)
    expect((await readFile(out)).byteLength).toBeGreaterThan(100)
    await rm(out, { force: true })
  }, 30000)
})
