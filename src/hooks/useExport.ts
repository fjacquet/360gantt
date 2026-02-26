import type { RefObject } from 'react'
import { toast } from 'sonner'

/**
 * Prepares the Gantt element for full capture:
 * - Resets CSS zoom (html2canvas doesn't handle it reliably)
 * - Expands SVAR's internal scroll containers so all rows/columns are in the DOM
 *
 * Returns a cleanup function to restore original styles.
 */
function expandForCapture(el: HTMLElement): () => void {
  // Reset CSS zoom on the container itself
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const style = el.style as any
  const prevZoom = (style['zoom'] as string) ?? ''
  style['zoom'] = '1'

  // Expand SVAR scroll/clip containers: .wx-gantt (rows), .wx-chart (timeline), .wx-bars (bar area)
  type Snapshot = { el: HTMLElement; overflow: string; overflowX: string; overflowY: string; height: string; maxHeight: string }
  const snapshots: Snapshot[] = []

  el.querySelectorAll<HTMLElement>('.wx-gantt, .wx-chart, .wx-bars').forEach((s) => {
    snapshots.push({
      el: s,
      overflow: s.style.overflow,
      overflowX: s.style.overflowX,
      overflowY: s.style.overflowY,
      height: s.style.height,
      maxHeight: s.style.maxHeight,
    })
    s.style.overflow = 'visible'
    s.style.overflowX = 'visible'
    s.style.overflowY = 'visible'
    s.style.height = 'auto'
    s.style.maxHeight = 'none'
  })

  return () => {
    style['zoom'] = prevZoom
    snapshots.forEach(({ el: s, overflow, overflowX, overflowY, height, maxHeight }) => {
      s.style.overflow = overflow
      s.style.overflowX = overflowX
      s.style.overflowY = overflowY
      s.style.height = height
      s.style.maxHeight = maxHeight
    })
  }
}

/**
 * Captures a DOM element as a PNG data URL at 2× resolution.
 * Expands all scroll containers first so the full chart is captured.
 */
async function captureElement(el: HTMLElement): Promise<string> {
  const { default: html2canvas } = await import('html2canvas')

  const restore = expandForCapture(el)

  // Two animation frames: first lets styles apply, second lets SVAR re-render rows
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

  const w = el.scrollWidth
  const h = el.scrollHeight

  let dataUrl: string
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      scrollX: 0,
      scrollY: 0,
    })
    dataUrl = canvas.toDataURL('image/png')
  } finally {
    restore()
  }

  return dataUrl
}

/**
 * Load an Image from a data URL and return it once loaded.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function useExport(ganttRef: RefObject<HTMLDivElement | null>) {
  const exportPdf = async () => {
    const el = ganttRef.current
    if (!el) return
    const toastId = toast.loading('Generating PDF…')
    try {
      const [{ default: jsPDF }, imgData] = await Promise.all([import('jspdf'), captureElement(el)])
      const img = await loadImage(imgData)

      // Use custom page size so 1 CSS pixel = 1pt (72 dpi).
      // html2canvas captures at 2× so we halve the pixel count to get logical pt.
      // This keeps text readable (12px font → 12pt on page) regardless of chart size.
      const scale = 2 // must match the scale passed to html2canvas
      const pageW = img.naturalWidth / scale   // pt
      const pageH = img.naturalHeight / scale  // pt

      // Split tall charts into portrait-style pages (each page = full width, viewport height slice).
      // We use the original element's visible height as a natural page break unit.
      const visibleH = el.offsetHeight // CSS px ≈ pt at 1x

      if (pageH <= visibleH * 1.1) {
        // Single page — fits within one viewport height (with 10% tolerance)
        const doc = new jsPDF({
          orientation: pageW >= pageH ? 'landscape' : 'portrait',
          unit: 'pt',
          format: [pageW, pageH],
        })
        doc.addImage(imgData, 'PNG', 0, 0, pageW, pageH)
        doc.save('360gantt-export.pdf')
      } else {
        // Multi-page: each page is [pageW × visibleH] pt
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [pageW, visibleH] })
        const slicePixels = Math.round(visibleH * scale) // image pixels per page
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
            // Keep aspect of the slice (last page may be shorter)
            const sliceH = (hPx / scale)
            doc.addImage(slice, 'PNG', 0, 0, pageW, sliceH)
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
    const toastId = toast.loading('Generating PPTX…')
    try {
      const [{ default: PptxGenJS }, imgData] = await Promise.all([
        import('pptxgenjs'),
        captureElement(el),
      ])
      const img = await loadImage(imgData)

      const pptx = new PptxGenJS()
      // Custom slide dimensions matching the captured image (in inches at 96 dpi)
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

  return { exportPdf, exportPptx }
}
