import { Buffer } from 'node:buffer'
import { writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { toMermaid } from '@engines/csv/mermaid'
import { jsPDF } from 'jspdf'
import PptxGenJS from 'pptxgenjs'
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
  const doc = new jsPDF({
    orientation: w >= h ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [w, h],
  })
  doc.addImage(toDataUri(data), 'PNG', 0, 0, w, h)
  const pdfBytes = doc.output('arraybuffer') as ArrayBuffer
  await writeFile(outPath, Buffer.from(pdfBytes))
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
