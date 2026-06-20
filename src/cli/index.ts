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
      const { ganttData, parseErrors } = parseCsvToGantt(csv)
      const svg = renderGanttSvg(ganttData.tasks, preset.scales, { dark: opts.dark })
      await writeExport(format, { svg, tasks: ganttData.tasks, outPath: opts.output })
      process.stdout.write(`Wrote ${opts.output}\n`)
      if (parseErrors.length > 0)
        process.stderr.write(`Warning: ${parseErrors.length} CSV parse issue(s)\n`)
    })
  return program
}

buildProgram()
  .parseAsync(process.argv)
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
    process.exitCode = 1
  })
