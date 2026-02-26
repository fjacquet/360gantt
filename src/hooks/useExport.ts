import type { RefObject } from 'react'
import { toast } from 'sonner'

/**
 * Captures a DOM element as a PNG data URL at 2× scale.
 * Dynamic import keeps html2canvas out of the initial bundle.
 */
async function captureElement(el: HTMLElement): Promise<string> {
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    // Capture the full scrollable height, not just the visible viewport
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  })
  return canvas.toDataURL('image/png')
}

export function useExport(ganttRef: RefObject<HTMLDivElement | null>) {
  const exportPdf = async () => {
    const el = ganttRef.current
    if (!el) return
    const toastId = toast.loading('Generating PDF…')
    try {
      const [{ default: jsPDF }, imgData] = await Promise.all([
        import('jspdf'),
        captureElement(el),
      ])
      // Use the actual captured canvas aspect ratio to fit on A4 landscape
      const img = new Image()
      img.src = imgData
      await new Promise<void>((res) => {
        img.onload = () => res()
      })
      const ratio = img.naturalHeight / img.naturalWidth

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()

      // Fit image width to page; if taller than page, let it overflow onto more pages
      const imgH = pageW * ratio
      if (imgH <= pageH) {
        doc.addImage(imgData, 'PNG', 0, 0, pageW, imgH)
      } else {
        // Multi-page: slice the image into page-height segments
        const sliceH = Math.floor((pageH / imgH) * img.naturalHeight)
        let y = 0
        let page = 0
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        while (y < img.naturalHeight) {
          const h = Math.min(sliceH, img.naturalHeight - y)
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, y, img.naturalWidth, h, 0, 0, img.naturalWidth, h)
            const slice = canvas.toDataURL('image/png')
            if (page > 0) doc.addPage()
            doc.addImage(slice, 'PNG', 0, 0, pageW, pageH * (h / sliceH))
          }
          y += h
          page++
        }
      }

      doc.save('360gantt-export.pdf')
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
      const pptx = new PptxGenJS()
      pptx.layout = 'LAYOUT_WIDE'
      const slide = pptx.addSlide()
      slide.addImage({ data: imgData, x: 0, y: 0, w: '100%', h: '100%' })
      await pptx.writeFile({ fileName: '360gantt-export.pptx' })
      toast.success('PPTX downloaded', { id: toastId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      toast.error(msg, { id: toastId })
    }
  }

  return { exportPdf, exportPptx }
}
