import type { RefObject } from 'react'
import { toast } from 'sonner'
import { useAssetStore } from '@store/assetStore'

/**
 * Captures the SVG element inside the ref'd div as a PNG data URL at 2x resolution.
 * Uses SVG serialization instead of html2canvas.
 */
async function captureElement(el: HTMLElement): Promise<string> {
  const svg = el.querySelector('svg')
  if (!svg) throw new Error('No SVG element found')

  // Clone the SVG and ensure xmlns is set
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(clone)
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const svgWidth = svg.width.baseVal.value
  const svgHeight = svg.height.baseVal.value
  const scale = 2

  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = svgWidth * scale
    canvas.height = svgHeight * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Cannot get canvas context')
    ctx.drawImage(img, 0, 0, svgWidth * scale, svgHeight * scale)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Maps a bar color to a Mermaid task status keyword.
 */
function colorToMermaidStatus(color: string | undefined): string {
  if (!color) return ''
  const c = color.toLowerCase()
  if (c === '#ef4444') return 'crit, '   // red = critical
  if (c === '#f59e0b') return 'active, ' // amber = active/warning
  if (c === '#9ca3af') return 'done, '   // gray = expired/done
  return ''                               // green or unknown = default
}

function formatMermaidDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function useExport(ganttRef: RefObject<HTMLDivElement | null>) {
  const exportPdf = async () => {
    const el = ganttRef.current
    if (!el) return
    const toastId = toast.loading('Generating PDF\u2026')
    try {
      const [{ default: jsPDF }, imgData] = await Promise.all([import('jspdf'), captureElement(el)])
      const img = await loadImage(imgData)

      const scale = 2
      const pageW = img.naturalWidth / scale
      const pageH = img.naturalHeight / scale

      const visibleH = el.offsetHeight

      if (pageH <= visibleH * 1.1) {
        const doc = new jsPDF({
          orientation: pageW >= pageH ? 'landscape' : 'portrait',
          unit: 'pt',
          format: [pageW, pageH],
        })
        doc.addImage(imgData, 'PNG', 0, 0, pageW, pageH)
        doc.save('360gantt-export.pdf')
      } else {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [pageW, visibleH] })
        const slicePixels = Math.round(visibleH * scale)
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth

        let yPx = 0
        let page = 0
        while (yPx < img.naturalHeight) {
          const hPx = Math.min(slicePixels, img.naturalHeight - yPx)
          canvas.height = hPx
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, yPx, img.naturalWidth, hPx, 0, 0, img.naturalWidth, hPx)
            const slice = canvas.toDataURL('image/png')
            if (page > 0) doc.addPage([pageW, visibleH], 'landscape')
            doc.addImage(slice, 'PNG', 0, 0, pageW, hPx / scale)
          }
          yPx += hPx
          page++
        }
        doc.save('360gantt-export.pdf')
      }

      toast.success('PDF downloaded', { id: toastId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      toast.error(msg, { id: toastId })
    }
  }

  const exportPptx = async () => {
    const el = ganttRef.current
    if (!el) return
    const toastId = toast.loading('Generating PPTX\u2026')
    try {
      const [{ default: PptxGenJS }, imgData] = await Promise.all([
        import('pptxgenjs'),
        captureElement(el),
      ])
      const img = await loadImage(imgData)

      const pptx = new PptxGenJS()
      const scale = 2
      const inchW = img.naturalWidth / scale / 96
      const inchH = img.naturalHeight / scale / 96
      pptx.defineLayout({ name: 'GANTT', width: inchW, height: inchH })
      pptx.layout = 'GANTT'

      const slide = pptx.addSlide()
      slide.addImage({ data: imgData, x: 0, y: 0, w: inchW, h: inchH })
      await pptx.writeFile({ fileName: '360gantt-export.pptx' })
      toast.success('PPTX downloaded', { id: toastId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      toast.error(msg, { id: toastId })
    }
  }

  const exportPng = async () => {
    const el = ganttRef.current
    if (!el) return
    const toastId = toast.loading('Generating PNG\u2026')
    try {
      const imgData = await captureElement(el)
      const a = document.createElement('a')
      a.href = imgData
      a.download = '360gantt-export.png'
      a.click()
      toast.success('PNG downloaded', { id: toastId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      toast.error(msg, { id: toastId })
    }
  }

  const exportMermaid = () => {
    const { ganttData } = useAssetStore.getState()
    const tasks = ganttData.tasks
    if (tasks.length === 0) return

    const lines: string[] = ['gantt', '  title 360gantt Export', '  dateFormat YYYY-MM-DD']

    // Group by location (top-level summary tasks)
    for (const task of tasks) {
      if (task.type === 'summary' && (task.parent === 0 || task.parent === undefined)) {
        // Location = section
        lines.push(`  section ${task.text}`)

        // Find product groups under this location
        const products = tasks.filter((t) => t.parent === task.id && t.type === 'summary')
        for (const prod of products) {
          // Find assets under this product
          const assets = tasks.filter((t) => t.parent === prod.id && t.type === 'task')
          if (assets.length > 0) {
            for (const asset of assets) {
              const status = colorToMermaidStatus(asset.color)
              lines.push(
                `    ${asset.text} :${status}${formatMermaidDate(asset.start)}, ${formatMermaidDate(asset.end)}`,
              )
            }
          } else {
            // No child assets — render the product summary itself
            const status = colorToMermaidStatus(prod.color)
            lines.push(
              `    ${prod.text} :${status}${formatMermaidDate(prod.start)}, ${formatMermaidDate(prod.end)}`,
            )
          }
        }
      }
    }

    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '360gantt-export.mmd'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Mermaid file downloaded')
  }

  return { exportPdf, exportPptx, exportPng, exportMermaid }
}
