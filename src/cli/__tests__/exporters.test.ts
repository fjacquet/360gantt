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
    expect(formatFromPath('a.svg')).toBe('svg')
    expect(formatFromPath('a.png')).toBe('png')
    expect(formatFromPath('a.pdf')).toBe('pdf')
    expect(formatFromPath('a.PPTX')).toBe('pptx')
    expect(formatFromPath('a.mmd')).toBe('mmd')
  })
  it('throws on an unsupported extension', () => {
    expect(() => formatFromPath('a.txt')).toThrow(/unsupported/i)
  })
})

describe('writeExport', () => {
  const scales = ZOOM_PRESETS[1]?.scales
  if (!scales) throw new Error('ZOOM_PRESETS[1] missing — test fixture broken')
  const svg = renderGanttSvg(tasks, scales)

  it.each(['svg', 'png', 'pdf', 'pptx', 'mmd'] as const)('writes a valid %s file', async (fmt) => {
    const out = join(tmpdir(), `360gantt-test.${fmt}`)
    try {
      await writeExport(fmt, { svg, tasks, outPath: out })
      expect(existsSync(out)).toBe(true)
      const buf = await readFile(out)
      expect(buf.byteLength).toBeGreaterThan(100)
      if (fmt === 'svg') expect(buf.toString('utf8')).toContain('<svg')
      if (fmt === 'mmd') expect(buf.toString('utf8')).toContain('gantt')
      if (fmt === 'png') expect(Array.from(buf.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
      if (fmt === 'pdf') expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
      if (fmt === 'pptx') expect(Array.from(buf.subarray(0, 2))).toEqual([0x50, 0x4b])
    } finally {
      await rm(out, { force: true })
    }
  }, 30000)
})
