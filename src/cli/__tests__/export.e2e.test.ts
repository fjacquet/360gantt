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
